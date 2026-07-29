import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  isServerEventType,
  type HistoryRepository,
  type NewServerEvent,
  type NewServerMetric,
} from "./history-repository.js";
import type {
  ObservedPlayer,
  ServerEvent,
  ServerMetric,
} from "../types/connections.js";
import {
  tightenFilePermissionsSync,
  type StoragePermissionWarningHandler,
} from "../services/storage-initialization-service.js";

interface MetricRow {
  id: number;
  server_id: string;
  status: string;
  player_count: number | null;
  max_players: number | null;
  fps: number | null;
  response_time_ms: number | null;
  uptime_seconds: number | null;
  captured_at: string;
}

interface EventRow {
  id: number;
  server_id: string;
  type: string;
  player_id: string | null;
  player_name: string | null;
  occurred_at: string;
}

interface PlayerRow {
  player_id: string;
  player_name: string;
}

interface UserVersionRow {
  user_version: number;
}

interface IntegrityCheckRow {
  quick_check: string;
}

const schemaVersion = 4;

export class SqliteHistoryRepository implements HistoryRepository {
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

    const versionRow = database
      .prepare("PRAGMA user_version")
      .get() as unknown as UserVersionRow | undefined;

    if (!versionRow) {
      throw new Error("Unable to read the history.sqlite schema version.");
    }

    const version = versionRow.user_version;

    if (version > schemaVersion) {
      throw new Error(
        `history.sqlite uses schema version ${version}, but this PalCenter version supports up to ${schemaVersion}.`,
      );
    }

    database.exec("BEGIN IMMEDIATE");

    try {
      database.exec(`
      CREATE TABLE IF NOT EXISTS server_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        server_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('online', 'offline')),
        player_count INTEGER,
        max_players INTEGER,
        fps REAL,
        response_time_ms INTEGER,
        uptime_seconds INTEGER,
        captured_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS server_metrics_server_time
        ON server_metrics (server_id, captured_at DESC);

      CREATE TABLE IF NOT EXISTS server_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        server_id TEXT NOT NULL,
        type TEXT NOT NULL,
        player_id TEXT,
        player_name TEXT,
        occurred_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS server_events_server_time
        ON server_events (server_id, occurred_at DESC);

      CREATE TABLE IF NOT EXISTS active_players (
        server_id TEXT NOT NULL,
        player_id TEXT NOT NULL,
        player_name TEXT NOT NULL,
        PRIMARY KEY (server_id, player_id)
      );

      CREATE TABLE IF NOT EXISTS scheduled_tasks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        server_id TEXT NOT NULL,
        enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
        task_type TEXT NOT NULL,
        schedule_json TEXT NOT NULL,
        time_zone TEXT NOT NULL,
        configuration_json TEXT NOT NULL,
        last_run_at TEXT,
        next_run_at TEXT,
        last_result TEXT CHECK (
          last_result IS NULL OR
          last_result IN ('running', 'success', 'failure')
        ),
        last_error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS scheduled_tasks_due
        ON scheduled_tasks (enabled, next_run_at);
      CREATE INDEX IF NOT EXISTS scheduled_tasks_server
        ON scheduled_tasks (server_id);

      CREATE TABLE IF NOT EXISTS task_executions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT NOT NULL,
        server_id TEXT NOT NULL,
        task_type TEXT NOT NULL,
        trigger TEXT NOT NULL CHECK (trigger IN ('scheduled', 'manual')),
        result TEXT NOT NULL CHECK (result IN ('running', 'success', 'failure')),
        started_at TEXT NOT NULL,
        finished_at TEXT,
        duration_ms INTEGER,
        error_message TEXT,
        snapshot_json TEXT,
        FOREIGN KEY (task_id) REFERENCES scheduled_tasks (id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS task_executions_task_time
        ON task_executions (task_id, started_at DESC);
      CREATE INDEX IF NOT EXISTS task_executions_result_time
        ON task_executions (result, started_at DESC);

      CREATE TABLE IF NOT EXISTS player_position_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        server_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        player_id TEXT,
        player_name TEXT NOT NULL,
        account_name TEXT,
        captured_at TEXT NOT NULL,
        x REAL,
        y REAL,
        z REAL,
        level INTEGER,
        ping REAL,
        building_count INTEGER,
        guild_id TEXT,
        guild_name TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS player_position_snapshots_server_player_time
        ON player_position_snapshots (
          server_id, user_id, captured_at DESC, id DESC
        );
      CREATE INDEX IF NOT EXISTS player_position_snapshots_server_time
        ON player_position_snapshots (server_id, captured_at DESC, id DESC);

      `);
      if (version < 3) {
        const columns = database
          .prepare("PRAGMA table_info(task_executions)")
          .all() as unknown as { name: string }[];
        if (!columns.some((column) => column.name === "snapshot_json")) {
          database.exec(
            "ALTER TABLE task_executions ADD COLUMN snapshot_json TEXT",
          );
        }
      }
      database.exec(`PRAGMA user_version = ${schemaVersion}`);
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }

    const integrity = database
      .prepare("PRAGMA quick_check")
      .get() as unknown as IntegrityCheckRow | undefined;

    if (!integrity || integrity.quick_check !== "ok") {
      throw new Error(
        `history.sqlite failed its integrity check: ${integrity?.quick_check ?? "no result"}`,
      );
    }
  }

  check(): void {
    this.requireDatabase().prepare("SELECT 1").get();
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

  latestMetric(serverId: string): ServerMetric | null {
    const row = this.requireDatabase()
      .prepare(
        `SELECT * FROM server_metrics
         WHERE server_id = ?
         ORDER BY captured_at DESC, id DESC
         LIMIT 1`,
      )
      .get(serverId) as MetricRow | undefined;

    return row ? this.metric(row) : null;
  }

  activePlayers(serverId: string): ObservedPlayer[] {
    const rows = this.requireDatabase()
      .prepare(
        `SELECT player_id, player_name FROM active_players
         WHERE server_id = ?`,
      )
      .all(serverId) as unknown as PlayerRow[];

    return rows.map((row) => ({
      playerId: row.player_id,
      name: row.player_name,
    }));
  }

  saveSample(
    metric: NewServerMetric,
    events: NewServerEvent[],
    players: ObservedPlayer[],
  ): ServerEvent[] {
    const database = this.requireDatabase();
    database.exec("BEGIN IMMEDIATE");

    try {
      const persistedEvents: ServerEvent[] = [];
      database
        .prepare(
          `INSERT INTO server_metrics (
            server_id, status, player_count, max_players, fps,
            response_time_ms, uptime_seconds, captured_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          metric.serverId,
          metric.status,
          metric.playerCount,
          metric.maxPlayers,
          metric.fps,
          metric.responseTimeMs,
          metric.uptimeSeconds,
          metric.capturedAt,
        );

      const insertEvent = database.prepare(
        `INSERT INTO server_events (
          server_id, type, player_id, player_name, occurred_at
        ) VALUES (?, ?, ?, ?, ?)`,
      );

      for (const event of events) {
        const result = insertEvent.run(
          event.serverId,
          event.type,
          event.playerId,
          event.playerName,
          event.occurredAt,
        );
        persistedEvents.push({
          id: Number(result.lastInsertRowid),
          ...event,
        });
      }

      database
        .prepare("DELETE FROM active_players WHERE server_id = ?")
        .run(metric.serverId);

      const insertPlayer = database.prepare(
        `INSERT INTO active_players (server_id, player_id, player_name)
         VALUES (?, ?, ?)`,
      );

      for (const player of players) {
        insertPlayer.run(metric.serverId, player.playerId, player.name);
      }

      database.exec("COMMIT");
      return persistedEvents;
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }

  appendEvent(event: NewServerEvent): ServerEvent {
    const result = this.requireDatabase()
      .prepare(
        `INSERT INTO server_events (
          server_id, type, player_id, player_name, occurred_at
        ) VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        event.serverId,
        event.type,
        event.playerId,
        event.playerName,
        event.occurredAt,
      );

    return {
      id: Number(result.lastInsertRowid),
      ...event,
    };
  }

  listMetrics(serverId: string, limit: number): ServerMetric[] {
    const rows = this.requireDatabase()
      .prepare(
        `SELECT * FROM server_metrics
         WHERE server_id = ?
         ORDER BY captured_at DESC, id DESC
         LIMIT ?`,
      )
      .all(serverId, limit) as unknown as MetricRow[];

    return rows.map((row) => this.metric(row)).reverse();
  }

  listEvents(serverId: string, limit: number): ServerEvent[] {
    const rows = this.requireDatabase()
      .prepare(
        `SELECT * FROM server_events
         WHERE server_id = ?
         ORDER BY occurred_at DESC, id DESC
         LIMIT ?`,
      )
      .all(serverId, limit) as unknown as EventRow[];

    return rows.map((row) => {
      if (!isServerEventType(row.type)) {
        throw new Error(`Unknown server event type "${row.type}".`);
      }

      return {
        id: row.id,
        serverId: row.server_id,
        type: row.type,
        playerId: row.player_id,
        playerName: row.player_name,
        occurredAt: row.occurred_at,
      };
    });
  }

  deleteServerData(serverId: string): void {
    const database = this.requireDatabase();
    database.exec("BEGIN IMMEDIATE");

    try {
      database
        .prepare("DELETE FROM active_players WHERE server_id = ?")
        .run(serverId);
      database
        .prepare("DELETE FROM server_events WHERE server_id = ?")
        .run(serverId);
      database
        .prepare("DELETE FROM server_metrics WHERE server_id = ?")
        .run(serverId);
      database
        .prepare("DELETE FROM task_executions WHERE server_id = ?")
        .run(serverId);
      database
        .prepare("DELETE FROM scheduled_tasks WHERE server_id = ?")
        .run(serverId);
      database
        .prepare("DELETE FROM player_position_snapshots WHERE server_id = ?")
        .run(serverId);
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }

  private metric(row: MetricRow): ServerMetric {
    if (row.status !== "online" && row.status !== "offline") {
      throw new Error(`Unknown server status "${row.status}".`);
    }

    return {
      id: row.id,
      serverId: row.server_id,
      status: row.status,
      playerCount: row.player_count,
      maxPlayers: row.max_players,
      fps: row.fps,
      responseTimeMs: row.response_time_ms,
      uptimeSeconds: row.uptime_seconds,
      capturedAt: row.captured_at,
    };
  }

  private open(): void {
    this.database = new DatabaseSync(this.databasePath);
    tightenFilePermissionsSync(this.databasePath, this.onPermissionWarning);
  }

  private requireDatabase(): DatabaseSync {
    if (!this.database) {
      throw new Error("history.sqlite is closed.");
    }

    return this.database;
  }
}
