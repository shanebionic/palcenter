import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  tightenFilePermissionsSync,
  type StoragePermissionWarningHandler,
} from "../services/storage-initialization-service.js";
import type {
  NewWorldEvent,
  PlayerActivityState,
  WorldEvent,
  WorldEventEvidence,
  WorldEventMetadata,
  WorldEventPosition,
  WorldEventQuery,
  WorldEventType,
} from "../types/world-events.js";
import type { WorldEventRepository } from "./world-event-repository.js";

interface WorldEventRow {
  id: string;
  server_id: string;
  user_id: string;
  player_id: string | null;
  occurred_at: string;
  type: WorldEventType;
  metadata_json: string;
  confidence: number;
  evidence_json: string;
  position_x: number | null;
  position_y: number | null;
  position_z: number | null;
}

interface ActivityStateRow {
  server_id: string;
  user_id: string;
  player_id: string | null;
  player_name: string;
  state: PlayerActivityState["state"];
  anchor_at: string;
  anchor_x: number;
  anchor_y: number;
  last_sample_at: string;
  last_x: number;
  last_y: number;
}

export class SqliteWorldEventRepository implements WorldEventRepository {
  private database: DatabaseSync | null = null;
  private readonly databasePath: string;

  constructor(
    configDirectory: string,
    private readonly onPermissionWarning: StoragePermissionWarningHandler = () =>
      undefined,
  ) {
    const directory = path.resolve(configDirectory);
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    this.databasePath = path.join(directory, "history.sqlite");
    this.open();
  }

  initialize(): void {
    const tables = this.requireDatabase()
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table'
           AND name IN ('world_events', 'world_player_activity_state')`,
      )
      .all();
    if (tables.length !== 2) {
      throw new Error(
        "World event storage is unavailable because history.sqlite has not been migrated.",
      );
    }
  }

  close(): void {
    this.database?.close();
    this.database = null;
  }

  reopen(): void {
    if (this.database) return;
    this.open();
    try {
      this.initialize();
    } catch (error) {
      this.close();
      throw error;
    }
  }

  append(events: NewWorldEvent[]): WorldEvent[] {
    if (events.length === 0) return [];
    const database = this.requireDatabase();
    database.exec("BEGIN IMMEDIATE");
    try {
      const inserted = this.insertEvents(database, events);
      database.exec("COMMIT");
      return inserted;
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }

  activityStates(serverId: string): PlayerActivityState[] {
    const rows = this.requireDatabase()
      .prepare(
        `SELECT * FROM world_player_activity_state
         WHERE server_id = ? ORDER BY user_id`,
      )
      .all(serverId) as unknown as ActivityStateRow[];
    return rows.map((row) => ({
      serverId: row.server_id,
      userId: row.user_id,
      playerId: row.player_id,
      playerName: row.player_name,
      state: row.state,
      anchorAt: row.anchor_at,
      anchorX: row.anchor_x,
      anchorY: row.anchor_y,
      lastSampleAt: row.last_sample_at,
      lastX: row.last_x,
      lastY: row.last_y,
    }));
  }

  commitActivityObservation(
    serverId: string,
    states: PlayerActivityState[],
    events: NewWorldEvent[],
  ): WorldEvent[] {
    const database = this.requireDatabase();
    const insertState = database.prepare(
      `INSERT INTO world_player_activity_state (
        server_id, user_id, player_id, player_name, state, anchor_at,
        anchor_x, anchor_y, last_sample_at, last_x, last_y
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    database.exec("BEGIN IMMEDIATE");
    try {
      const inserted = this.insertEvents(database, events);
      database
        .prepare("DELETE FROM world_player_activity_state WHERE server_id = ?")
        .run(serverId);
      for (const state of states) {
        insertState.run(
          state.serverId,
          state.userId,
          state.playerId,
          state.playerName,
          state.state,
          state.anchorAt,
          state.anchorX,
          state.anchorY,
          state.lastSampleAt,
          state.lastX,
          state.lastY,
        );
      }
      database.exec("COMMIT");
      return inserted;
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }

  private insertEvents(
    database: DatabaseSync,
    events: NewWorldEvent[],
  ): WorldEvent[] {
    const insert = database.prepare(
      `INSERT OR IGNORE INTO world_events (
        id, server_id, user_id, player_id, occurred_at, type, metadata_json,
        confidence, evidence_json, position_x, position_y, position_z
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const inserted: WorldEvent[] = [];
    for (const event of events) {
      const result = insert.run(
        event.id,
        event.serverId,
        event.userId,
        event.playerId,
        event.timestamp,
        event.type,
        JSON.stringify(event.metadata),
        event.confidence,
        JSON.stringify(event.evidence),
        event.position?.x ?? null,
        event.position?.y ?? null,
        event.position?.z ?? null,
      );
      if (result.changes > 0) inserted.push(event);
    }
    return inserted;
  }

  list(serverId: string, query: WorldEventQuery): WorldEvent[] {
    const conditions = ["server_id = ?"];
    const parameters: Array<string | number> = [serverId];
    if (query.userId) {
      conditions.push("user_id = ?");
      parameters.push(query.userId);
    }
    if (query.type) {
      conditions.push("type = ?");
      parameters.push(query.type);
    }
    if (query.from) {
      conditions.push("occurred_at >= ?");
      parameters.push(query.from);
    }
    if (query.to) {
      conditions.push("occurred_at <= ?");
      parameters.push(query.to);
    }
    parameters.push(query.limit);

    const rows = this.requireDatabase()
      .prepare(
        `SELECT * FROM (
          SELECT * FROM world_events
          WHERE ${conditions.join(" AND ")}
          ORDER BY occurred_at DESC, id DESC
          LIMIT ?
        ) ORDER BY occurred_at, id`,
      )
      .all(...parameters) as unknown as WorldEventRow[];
    return rows.map((row) => this.event(row));
  }

  deleteServerData(serverId: string): void {
    this.requireDatabase()
      .prepare("DELETE FROM world_events WHERE server_id = ?")
      .run(serverId);
    this.requireDatabase()
      .prepare("DELETE FROM world_player_activity_state WHERE server_id = ?")
      .run(serverId);
  }

  private event(row: WorldEventRow): WorldEvent {
    const position: WorldEventPosition | null =
      row.position_x === null || row.position_y === null
        ? null
        : { x: row.position_x, y: row.position_y, z: row.position_z };
    return {
      id: row.id,
      serverId: row.server_id,
      userId: row.user_id,
      playerId: row.player_id,
      timestamp: row.occurred_at,
      type: row.type,
      metadata: JSON.parse(row.metadata_json) as WorldEventMetadata,
      confidence: row.confidence,
      evidence: JSON.parse(row.evidence_json) as WorldEventEvidence[],
      position,
    };
  }

  private open(): void {
    this.database = new DatabaseSync(this.databasePath);
    tightenFilePermissionsSync(this.databasePath, this.onPermissionWarning);
  }

  private requireDatabase(): DatabaseSync {
    if (!this.database)
      throw new Error("history.sqlite event storage is closed.");
    return this.database;
  }
}
