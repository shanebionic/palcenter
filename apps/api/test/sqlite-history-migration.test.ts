import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { SqliteHistoryRepository } from "../src/repositories/sqlite-history-repository.js";
import { SqliteWorldEventRepository } from "../src/repositories/sqlite-world-event-repository.js";
import { SqliteTelemetryRepository } from "../src/telemetry/repositories/sqlite-telemetry-repository.js";
import type { NewPlayerPositionSnapshot } from "../src/telemetry/types/player-telemetry.js";
import type { PlayerActivityState } from "../src/types/world-events.js";

const CURRENT_SCHEMA_VERSION = 10;
const serverId = "srv_migration";
const legacyCapturedAt = "2026-07-01T10:00:00.000Z";
const legacyCreatedAt = "2026-07-01T10:00:00.000Z";

// Provenance: exact schema DDL shipped in tag v1.4.0
// (apps/api/src/repositories/sqlite-history-repository.ts, schemaVersion = 4).
// player_position_snapshots has no coordinate_space_id column.
const V1_4_0_SCHEMA = `
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
`;

// Provenance: world tables exactly as introduced in commit b72a9e9
// (schemaVersion = 6): world_events without the player_rapid_relocation type
// and world_player_activity_state without coordinate_space_id.
const V6_WORLD_TABLES = `
  CREATE TABLE IF NOT EXISTS world_events (
    id TEXT PRIMARY KEY,
    server_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    player_id TEXT,
    occurred_at TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN (
      'player_joined', 'player_disconnected',
      'session_started', 'session_ended',
      'player_died', 'player_respawned',
      'player_idle_started', 'player_idle_ended',
      'player_afk_started', 'player_afk_ended'
    )),
    metadata_json TEXT NOT NULL,
    confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    evidence_json TEXT NOT NULL,
    position_x REAL,
    position_y REAL,
    position_z REAL,
    CHECK (
      (position_x IS NULL AND position_y IS NULL AND position_z IS NULL) OR
      (position_x IS NOT NULL AND position_y IS NOT NULL)
    )
  );
  CREATE INDEX IF NOT EXISTS world_events_server_time
    ON world_events (server_id, occurred_at, id);
  CREATE INDEX IF NOT EXISTS world_events_server_player_time
    ON world_events (server_id, user_id, occurred_at, id);

  CREATE TABLE IF NOT EXISTS world_player_activity_state (
    server_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    player_id TEXT,
    player_name TEXT NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('active', 'idle', 'afk')),
    anchor_at TEXT NOT NULL,
    anchor_x REAL NOT NULL,
    anchor_y REAL NOT NULL,
    last_sample_at TEXT NOT NULL,
    last_x REAL NOT NULL,
    last_y REAL NOT NULL,
    PRIMARY KEY (server_id, user_id)
  );
`;

function tempDirectory(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function databasePath(directory: string): string {
  return path.join(directory, "history.sqlite");
}

function insertLegacyCoreRows(database: DatabaseSync): void {
  database
    .prepare(
      `INSERT INTO server_metrics (
        server_id, status, player_count, max_players, fps,
        response_time_ms, uptime_seconds, captured_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(serverId, "online", 1, 4, 60, 12, 3600, legacyCapturedAt);
  database
    .prepare(
      `INSERT INTO server_events (server_id, type, player_id, player_name, occurred_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      serverId,
      "player_joined",
      "player-legacy",
      "LegacyPal",
      legacyCapturedAt,
    );
  database
    .prepare(
      `INSERT INTO active_players (server_id, player_id, player_name)
       VALUES (?, ?, ?)`,
    )
    .run(serverId, "player-legacy", "LegacyPal");
}

function insertLegacySnapshot(database: DatabaseSync): void {
  database
    .prepare(
      `INSERT INTO player_position_snapshots (
        server_id, user_id, player_id, player_name, account_name, captured_at,
        x, y, z, level, ping, building_count, guild_id, guild_name, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      serverId,
      "user-legacy",
      "player-legacy",
      "LegacyPal",
      "legacy-account",
      legacyCapturedAt,
      12.5,
      -34.25,
      7,
      12,
      42.5,
      3,
      "guild-1",
      "Guild One",
      legacyCreatedAt,
    );
}

function insertLegacyActivityState(
  database: DatabaseSync,
  withColumn: boolean,
): void {
  if (withColumn) {
    database
      .prepare(
        `INSERT INTO world_player_activity_state (
          server_id, user_id, player_id, player_name, state, anchor_at,
          anchor_x, anchor_y, last_sample_at, last_x, last_y,
          coordinate_space_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        serverId,
        "user-legacy",
        "player-legacy",
        "LegacyPal",
        "active",
        legacyCapturedAt,
        12.5,
        -34.25,
        legacyCapturedAt,
        12.5,
        -34.25,
        "unknown",
      );
    return;
  }
  database
    .prepare(
      `INSERT INTO world_player_activity_state (
        server_id, user_id, player_id, player_name, state, anchor_at,
        anchor_x, anchor_y, last_sample_at, last_x, last_y
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      serverId,
      "user-legacy",
      "player-legacy",
      "LegacyPal",
      "active",
      legacyCapturedAt,
      12.5,
      -34.25,
      legacyCapturedAt,
      12.5,
      -34.25,
    );
}

function insertLegacyWorldEvent(database: DatabaseSync): void {
  database
    .prepare(
      `INSERT INTO world_events (
        id, server_id, user_id, player_id, occurred_at, type,
        metadata_json, confidence, evidence_json,
        position_x, position_y, position_z
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      "wev-legacy",
      serverId,
      "user-legacy",
      "player-legacy",
      legacyCapturedAt,
      "player_joined",
      "{}",
      1,
      "[]",
      null,
      null,
      null,
    );
}

function buildV140Directory(): string {
  const directory = tempDirectory("palcenter-mig-v140-");
  const database = new DatabaseSync(databasePath(directory));
  database.exec(V1_4_0_SCHEMA);
  insertLegacyCoreRows(database);
  insertLegacySnapshot(database);
  database.exec("PRAGMA user_version = 4");
  database.close();
  return directory;
}

function buildV6Directory(): string {
  const directory = tempDirectory("palcenter-mig-v6-");
  const database = new DatabaseSync(databasePath(directory));
  database.exec(V1_4_0_SCHEMA);
  database.exec(V6_WORLD_TABLES);
  insertLegacyCoreRows(database);
  insertLegacySnapshot(database);
  insertLegacyActivityState(database, false);
  insertLegacyWorldEvent(database);
  database.exec("PRAGMA user_version = 6");
  database.close();
  return directory;
}

function buildBrokenV10Directory(options: {
  missingSnapshotColumn: boolean;
  missingActivityColumn: boolean;
}): string {
  const directory = tempDirectory("palcenter-mig-v10-");
  const history = new SqliteHistoryRepository(directory);
  history.initialize();
  history.close();
  const database = new DatabaseSync(databasePath(directory));
  if (options.missingSnapshotColumn) {
    database.exec(
      "ALTER TABLE player_position_snapshots DROP COLUMN coordinate_space_id",
    );
  }
  if (options.missingActivityColumn) {
    database.exec(
      "ALTER TABLE world_player_activity_state DROP COLUMN coordinate_space_id",
    );
  }
  insertLegacyCoreRows(database);
  insertLegacySnapshot(database);
  insertLegacyActivityState(database, !options.missingActivityColumn);
  insertLegacyWorldEvent(database);
  database.exec("PRAGMA user_version = 10");
  database.close();
  return directory;
}

function schemaDump(database: DatabaseSync): string {
  return database
    .prepare(
      "SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY type, name",
    )
    .all()
    .map((row) => `${row.type}:${row.name}:${row.sql}`)
    .join("\n");
}

function countOf(
  database: DatabaseSync,
  sql: string,
  ...parameters: unknown[]
): number {
  return Number(
    (database.prepare(sql).get(...parameters) as { cnt: number }).cnt,
  );
}

function newSnapshot(
  overrides: Partial<NewPlayerPositionSnapshot> = {},
): NewPlayerPositionSnapshot {
  return {
    serverId,
    userId: "user-new",
    playerId: "player-new",
    playerName: "NewPal",
    accountName: null,
    capturedAt: "2026-08-01T10:00:00.000Z",
    x: 1,
    y: 2,
    z: 3,
    level: 5,
    ping: 20,
    buildingCount: 0,
    guildId: null,
    guildName: null,
    coordinateSpaceId: "palpagos",
    ...overrides,
  };
}

function newActivityState(coordinateSpaceId: string): PlayerActivityState {
  return {
    serverId,
    userId: "user-legacy",
    playerId: "player-legacy",
    playerName: "LegacyPal",
    state: "active",
    anchorAt: "2026-08-01T10:00:00.000Z",
    anchorX: 1,
    anchorY: 2,
    lastSampleAt: "2026-08-01T10:00:00.000Z",
    lastX: 1,
    lastY: 2,
    coordinateSpaceId,
  };
}

interface VerifyOptions {
  expectLegacyRows: boolean;
  expectLegacyActivityRow: boolean;
  expectLegacyWorldEvent: boolean;
}

function assertMigratedFixture(
  directory: string,
  options: VerifyOptions,
): void {
  const history = new SqliteHistoryRepository(directory);
  const world = new SqliteWorldEventRepository(directory);
  const telemetry = new SqliteTelemetryRepository(directory);
  let restarted: SqliteHistoryRepository | null = null;
  let after: DatabaseSync | null = null;
  let raw: DatabaseSync | null = null;
  try {
    history.initialize();
    world.initialize();
    telemetry.initialize();

    raw = new DatabaseSync(databasePath(directory), { readOnly: true });
    const version = raw.prepare("PRAGMA user_version").get() as {
      user_version: number;
    };
    assert.equal(version.user_version, CURRENT_SCHEMA_VERSION);
    assert.ok(
      (
        raw
          .prepare("PRAGMA table_info(player_position_snapshots)")
          .all() as unknown as Array<{ name: string }>
      ).some((column) => column.name === "coordinate_space_id"),
    );
    assert.ok(
      (
        raw
          .prepare("PRAGMA table_info(world_player_activity_state)")
          .all() as unknown as Array<{ name: string }>
      ).some((column) => column.name === "coordinate_space_id"),
    );
    const legacyRowCount = options.expectLegacyRows ? 1 : 0;
    assert.equal(
      countOf(
        raw,
        "SELECT COUNT(*) AS cnt FROM server_metrics WHERE server_id = ?",
        serverId,
      ),
      legacyRowCount,
    );
    assert.equal(
      countOf(
        raw,
        "SELECT COUNT(*) AS cnt FROM server_events WHERE server_id = ?",
        serverId,
      ),
      legacyRowCount,
    );
    assert.equal(
      countOf(
        raw,
        "SELECT COUNT(*) AS cnt FROM active_players WHERE server_id = ?",
        serverId,
      ),
      legacyRowCount,
    );
    if (options.expectLegacyRows) {
      const legacy = raw
        .prepare(
          "SELECT * FROM player_position_snapshots WHERE user_id = 'user-legacy'",
        )
        .get() as Record<string, unknown>;
      assert.equal(legacy.player_name, "LegacyPal");
      assert.equal(legacy.captured_at, legacyCapturedAt);
      assert.equal(legacy.x, 12.5);
      assert.equal(legacy.y, -34.25);
      assert.equal(legacy.coordinate_space_id, "unknown");
    }
    if (options.expectLegacyActivityRow) {
      const state = raw
        .prepare(
          "SELECT * FROM world_player_activity_state WHERE user_id = 'user-legacy'",
        )
        .get() as Record<string, unknown>;
      assert.equal(state.player_name, "LegacyPal");
      assert.equal(state.state, "active");
      assert.equal(state.coordinate_space_id, "unknown");
    }
    if (options.expectLegacyWorldEvent) {
      assert.equal(
        countOf(
          raw,
          "SELECT COUNT(*) AS cnt FROM world_events WHERE id = ?",
          "wev-legacy",
        ),
        1,
      );
    }
    const snapshotCount = countOf(
      raw,
      "SELECT COUNT(*) AS cnt FROM player_position_snapshots",
    );
    const before = schemaDump(raw);
    raw.close();
    raw = null;

    telemetry.insertPlayerSnapshots([newSnapshot()]);
    const latest = telemetry.latestPlayerSnapshots(serverId);
    assert.equal(latest.length, options.expectLegacyRows ? 2 : 1);
    const inSpace = telemetry.latestPlayerSnapshotsInSpace(
      serverId,
      options.expectLegacyRows ? "unknown" : "palpagos",
    );
    assert.equal(inSpace.length, 1);
    assert.equal(
      inSpace[0]?.playerName,
      options.expectLegacyRows ? "LegacyPal" : "NewPal",
    );

    if (options.expectLegacyActivityRow) {
      const states = world.activityStates(serverId);
      assert.equal(states.length, 1);
      assert.equal(states[0]?.playerName, "LegacyPal");
      assert.equal(states[0]?.coordinateSpaceId, "unknown");
    }
    world.commitActivityObservation(
      serverId,
      [newActivityState("palpagos")],
      [],
    );
    const updated = world.activityStates(serverId);
    assert.equal(updated.length, 1);
    assert.equal(updated[0]?.coordinateSpaceId, "palpagos");

    history.close();
    world.close();
    telemetry.close();

    restarted = new SqliteHistoryRepository(directory);
    restarted.initialize();
    after = new DatabaseSync(databasePath(directory), { readOnly: true });
    assert.equal(
      schemaDump(after),
      before,
      "re-initialization must not change the schema",
    );
    assert.equal(
      countOf(after, "SELECT COUNT(*) AS cnt FROM player_position_snapshots"),
      snapshotCount + 1,
    );
    after.close();
    after = null;
    restarted.close();
    restarted = null;
  } finally {
    after?.close();
    raw?.close();
    restarted?.close();
    history.close();
    world.close();
    telemetry.close();
  }
}

test("genuine v1.4.0 (schema v4) databases upgrade to the current schema", () => {
  const directory = buildV140Directory();
  try {
    assertMigratedFixture(directory, {
      expectLegacyRows: true,
      expectLegacyActivityRow: false,
      expectLegacyWorldEvent: false,
    });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("schema v6 databases upgrade to the current schema", () => {
  const directory = buildV6Directory();
  try {
    assertMigratedFixture(directory, {
      expectLegacyRows: true,
      expectLegacyActivityRow: true,
      expectLegacyWorldEvent: true,
    });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("schema v10 databases missing the snapshot coordinate_space_id column are repaired", () => {
  const directory = buildBrokenV10Directory({
    missingSnapshotColumn: true,
    missingActivityColumn: false,
  });
  try {
    assertMigratedFixture(directory, {
      expectLegacyRows: true,
      expectLegacyActivityRow: true,
      expectLegacyWorldEvent: true,
    });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("schema v10 databases missing both coordinate_space_id columns are repaired", () => {
  const directory = buildBrokenV10Directory({
    missingSnapshotColumn: true,
    missingActivityColumn: true,
  });
  try {
    assertMigratedFixture(directory, {
      expectLegacyRows: true,
      expectLegacyActivityRow: true,
      expectLegacyWorldEvent: true,
    });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("re-initializing an already-current database is an idempotent no-op", () => {
  const directory = tempDirectory("palcenter-mig-current-");
  try {
    const seeded = new SqliteHistoryRepository(directory);
    seeded.initialize();
    const seededTelemetry = new SqliteTelemetryRepository(directory);
    seededTelemetry.initialize();
    seededTelemetry.insertPlayerSnapshots([newSnapshot()]);
    seeded.close();
    seededTelemetry.close();
    assertMigratedFixture(directory, {
      expectLegacyRows: false,
      expectLegacyActivityRow: false,
      expectLegacyWorldEvent: false,
    });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("a fresh database initializes to the current schema", () => {
  const directory = tempDirectory("palcenter-mig-fresh-");
  try {
    const history = new SqliteHistoryRepository(directory);
    const world = new SqliteWorldEventRepository(directory);
    const telemetry = new SqliteTelemetryRepository(directory);
    try {
      history.initialize();
      world.initialize();
      telemetry.initialize();
      const raw = new DatabaseSync(databasePath(directory), { readOnly: true });
      const version = raw.prepare("PRAGMA user_version").get() as {
        user_version: number;
      };
      assert.equal(version.user_version, CURRENT_SCHEMA_VERSION);
      raw.close();
      telemetry.insertPlayerSnapshots([newSnapshot()]);
      assert.equal(telemetry.latestPlayerSnapshots(serverId).length, 1);
      world.commitActivityObservation(
        serverId,
        [newActivityState("palpagos")],
        [],
      );
      assert.equal(world.activityStates(serverId).length, 1);
    } finally {
      history.close();
      world.close();
      telemetry.close();
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
