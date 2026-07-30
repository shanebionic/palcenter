import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  tightenFilePermissionsSync,
  type StoragePermissionWarningHandler,
} from "../../services/storage-initialization-service.js";
import type {
  NewPlayerPositionSnapshot,
  PlayerPositionSnapshot,
  PlayerTelemetryHistoryQuery,
} from "../types/player-telemetry.js";
import type { TelemetryRepository } from "./telemetry-repository.js";

interface SnapshotRow {
  id: number;
  server_id: string;
  user_id: string;
  player_id: string | null;
  player_name: string;
  account_name: string | null;
  captured_at: string;
  x: number | null;
  y: number | null;
  z: number | null;
  level: number | null;
  ping: number | null;
  building_count: number | null;
  guild_id: string | null;
  guild_name: string | null;
  created_at: string;
}

export class SqliteTelemetryRepository implements TelemetryRepository {
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
    const database = this.requireDatabase();
    database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA busy_timeout = 5000;
      PRAGMA foreign_keys = ON;
    `);

    const table = database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'player_position_snapshots'`,
      )
      .get() as { name: string } | undefined;

    if (!table) {
      throw new Error(
        "Telemetry storage is unavailable because history.sqlite has not been migrated.",
      );
    }
  }

  close(): void {
    this.database?.close();
    this.database = null;
  }

  reopen(): void {
    if (this.database) {
      return;
    }

    this.open();
    try {
      this.initialize();
    } catch (error) {
      this.close();
      throw error;
    }
  }

  insertPlayerSnapshots(snapshots: NewPlayerPositionSnapshot[]): void {
    if (snapshots.length === 0) {
      return;
    }

    const database = this.requireDatabase();
    const insert = database.prepare(
      `INSERT INTO player_position_snapshots (
        server_id, user_id, player_id, player_name, account_name, captured_at,
        x, y, z, level, ping, building_count,
        guild_id, guild_name, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const createdAt = new Date().toISOString();

    database.exec("BEGIN IMMEDIATE");
    try {
      for (const snapshot of snapshots) {
        insert.run(
          snapshot.serverId,
          snapshot.userId,
          snapshot.playerId,
          snapshot.playerName,
          snapshot.accountName,
          snapshot.capturedAt,
          snapshot.x,
          snapshot.y,
          snapshot.z,
          snapshot.level,
          snapshot.ping,
          snapshot.buildingCount,
          snapshot.guildId,
          snapshot.guildName,
          createdAt,
        );
      }
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }

  latestPlayerSnapshots(serverId: string): PlayerPositionSnapshot[] {
    const rows = this.requireDatabase()
      .prepare(
        `SELECT snapshot.*
         FROM player_position_snapshots snapshot
         WHERE snapshot.server_id = ?
           AND snapshot.id = (
             SELECT latest.id
             FROM player_position_snapshots latest
             WHERE latest.server_id = snapshot.server_id
               AND latest.user_id = snapshot.user_id
             ORDER BY latest.captured_at DESC, latest.id DESC
             LIMIT 1
           )
         ORDER BY snapshot.player_name COLLATE NOCASE, snapshot.user_id`,
      )
      .all(serverId) as unknown as SnapshotRow[];

    return rows.map((row) => this.snapshot(row));
  }

  playerHistory(
    serverId: string,
    userId: string,
    query: PlayerTelemetryHistoryQuery,
  ): PlayerPositionSnapshot[] {
    const conditions = ["server_id = ?", "user_id = ?"];
    const parameters: Array<string | number> = [serverId, userId];

    if (query.from) {
      conditions.push("captured_at >= ?");
      parameters.push(query.from);
    }
    if (query.to) {
      conditions.push("captured_at <= ?");
      parameters.push(query.to);
    }
    parameters.push(query.limit);

    const rows = this.requireDatabase()
      .prepare(
        `SELECT * FROM player_position_snapshots
         WHERE ${conditions.join(" AND ")}
         ORDER BY captured_at DESC, id DESC
         LIMIT ?`,
      )
      .all(...parameters) as unknown as SnapshotRow[];

    return rows.map((row) => this.snapshot(row)).reverse();
  }

  deleteExpiredPlayerSnapshots(cutoff: string, limit: number): number {
    const result = this.requireDatabase()
      .prepare(
        `DELETE FROM player_position_snapshots
         WHERE id IN (
           SELECT id FROM player_position_snapshots
           WHERE captured_at < ?
           ORDER BY captured_at, id
           LIMIT ?
         )`,
      )
      .run(cutoff, limit);

    return Number(result.changes);
  }

  deleteServerData(serverId: string): void {
    this.requireDatabase()
      .prepare("DELETE FROM player_position_snapshots WHERE server_id = ?")
      .run(serverId);
  }

  private snapshot(row: SnapshotRow): PlayerPositionSnapshot {
    return {
      id: row.id,
      serverId: row.server_id,
      userId: row.user_id,
      playerId: row.player_id,
      playerName: row.player_name,
      accountName: row.account_name,
      capturedAt: row.captured_at,
      x: row.x,
      y: row.y,
      z: row.z,
      level: row.level,
      ping: row.ping,
      buildingCount: row.building_count,
      guildId: row.guild_id,
      guildName: row.guild_name,
      createdAt: row.created_at,
    };
  }

  private open(): void {
    this.database = new DatabaseSync(this.databasePath);
    tightenFilePermissionsSync(this.databasePath, this.onPermissionWarning);
  }

  private requireDatabase(): DatabaseSync {
    if (!this.database) {
      throw new Error("history.sqlite telemetry storage is closed.");
    }
    return this.database;
  }
}
