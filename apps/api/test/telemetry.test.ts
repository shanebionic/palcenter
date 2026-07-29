import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import type { ConnectionRepository } from "../src/repositories/connection-repository.js";
import { SqliteHistoryRepository } from "../src/repositories/sqlite-history-repository.js";
import { PlayerTelemetryCollector } from "../src/telemetry/collectors/player-telemetry-collector.js";
import { SqliteTelemetryRepository } from "../src/telemetry/repositories/sqlite-telemetry-repository.js";
import { TelemetryService } from "../src/telemetry/services/telemetry-service.js";
import {
  defaultTelemetryRetentionDays,
  maximumTelemetryRetentionDays,
  minimumTelemetryRetentionDays,
  telemetryRetentionDaysSchema,
} from "../src/telemetry/telemetry-configuration.js";
import type { NewPlayerPositionSnapshot } from "../src/telemetry/types/player-telemetry.js";
import type {
  PalworldPlayersResponse,
  StoredConnection,
} from "../src/types/connections.js";

const timestamp = "2026-07-28T12:00:00.000Z";

function connection(id: string): StoredConnection {
  return {
    id,
    name: id,
    baseUrl: `http://${id}.example:8212`,
    adminPassword: "not-logged",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function response(
  overrides: Partial<PalworldPlayersResponse["players"][number]> = {},
): PalworldPlayersResponse {
  return {
    players: [
      {
        name: "Bob",
        accountName: "bob-account",
        playerId: "pal-player-id",
        userId: "steam-user-id",
        ping: 24,
        location_x: 12345,
        location_y: -5678,
        level: 42,
        building_count: 3,
        ...overrides,
      },
    ],
  };
}

function snapshot(
  capturedAt: string,
  overrides: Partial<NewPlayerPositionSnapshot> = {},
): NewPlayerPositionSnapshot {
  return {
    serverId: "srv_one",
    userId: "steam-user-id",
    playerId: "pal-player-id",
    playerName: "Bob",
    accountName: "bob-account",
    capturedAt,
    x: 10,
    y: 20,
    z: null,
    level: 42,
    ping: 24,
    buildingCount: 3,
    guildId: null,
    guildName: null,
    ...overrides,
  };
}

class MemoryConnections implements ConnectionRepository {
  constructor(private readonly connections: StoredConnection[]) {}
  async initialize(): Promise<void> {}
  async list(): Promise<StoredConnection[]> {
    return this.connections;
  }
  async get(id: string): Promise<StoredConnection | null> {
    return this.connections.find((item) => item.id === id) ?? null;
  }
  async create(): Promise<void> {}
  async update(): Promise<void> {}
  async delete(): Promise<void> {}
}

test("collector normalizes player state and location without persisting credentials", async () => {
  const collector = new PlayerTelemetryCollector(() => ({
    getPlayers: async () => response({ name: "  Renamed Bob  " }),
  }));

  const snapshots = await collector.collect(connection("srv_one"), timestamp);

  assert.deepEqual(snapshots, [
    snapshot(timestamp, {
      playerName: "Renamed Bob",
      x: 12345,
      y: -5678,
      z: null,
    }),
  ]);
  assert.equal(JSON.stringify(snapshots).includes("not-logged"), false);
});

test("collector safely handles malformed players and missing coordinates", async () => {
  const malformed = response({
    userId: "",
    location_x: Number.NaN,
    location_y: Number.POSITIVE_INFINITY,
  });
  malformed.players.push({
    ...response().players[0],
    userId: "valid-user",
    location_x: Number.NaN,
    location_y: Number.POSITIVE_INFINITY,
  });

  const collector = new PlayerTelemetryCollector(() => ({
    getPlayers: async () => malformed,
  }));
  const snapshots = await collector.collect(connection("srv_one"), timestamp);

  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0]?.userId, "valid-user");
  assert.equal(snapshots[0]?.x, null);
  assert.equal(snapshots[0]?.y, null);
});

test("repository inserts, orders, limits, and returns latest renamed players", async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "palcenter-telemetry-"),
  );
  const history = new SqliteHistoryRepository(directory);
  history.initialize();
  const repository = new SqliteTelemetryRepository(directory);
  repository.initialize();

  try {
    repository.insertPlayerSnapshots([
      snapshot("2026-07-28T12:00:00.000Z"),
      snapshot("2026-07-28T12:00:30.000Z", {
        playerName: "Robert",
        x: 30,
      }),
      snapshot("2026-07-28T12:01:00.000Z", {
        userId: "another-user",
        playerId: "another-pal-player",
        playerName: "Alice",
        accountName: "alice-account",
      }),
    ]);

    const latest = repository.latestPlayerSnapshots("srv_one");
    assert.equal(latest.length, 2);
    assert.equal(
      latest.find((item) => item.userId === "steam-user-id")?.playerName,
      "Robert",
    );

    const historyRows = repository.playerHistory("srv_one", "steam-user-id", {
      from: "2026-07-28T12:00:00.000Z",
      to: "2026-07-28T12:01:00.000Z",
      limit: 1,
    });
    assert.equal(historyRows.length, 1);
    assert.equal(historyRows[0]?.capturedAt, "2026-07-28T12:00:30.000Z");
  } finally {
    repository.close();
    history.close();
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("v1.3 schema upgrades in place and preserves existing metrics", async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "palcenter-telemetry-migration-"),
  );
  const databasePath = path.join(directory, "history.sqlite");
  const legacy = new DatabaseSync(databasePath);
  legacy.exec(`
    CREATE TABLE server_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id TEXT NOT NULL,
      status TEXT NOT NULL,
      player_count INTEGER,
      max_players INTEGER,
      fps REAL,
      response_time_ms INTEGER,
      uptime_seconds INTEGER,
      captured_at TEXT NOT NULL
    );
    INSERT INTO server_metrics (
      server_id, status, player_count, max_players, fps,
      response_time_ms, uptime_seconds, captured_at
    ) VALUES ('srv_one', 'online', 1, 32, 60, 10, 100, '${timestamp}');
    PRAGMA user_version = 3;
  `);
  legacy.close();

  const history = new SqliteHistoryRepository(directory);
  history.initialize();
  const telemetry = new SqliteTelemetryRepository(directory);
  telemetry.initialize();

  try {
    assert.equal(history.latestMetric("srv_one")?.playerCount, 1);
    const migrated = new DatabaseSync(databasePath, { readOnly: true });
    const version = migrated.prepare("PRAGMA user_version").get() as {
      user_version: number;
    };
    assert.equal(version.user_version, 4);
    migrated.close();
  } finally {
    telemetry.close();
    history.close();
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("retention configuration enforces documented boundaries", () => {
  assert.equal(
    telemetryRetentionDaysSchema.parse(undefined),
    defaultTelemetryRetentionDays,
  );
  assert.equal(
    telemetryRetentionDaysSchema.parse(minimumTelemetryRetentionDays),
    minimumTelemetryRetentionDays,
  );
  assert.equal(
    telemetryRetentionDaysSchema.parse(maximumTelemetryRetentionDays),
    maximumTelemetryRetentionDays,
  );
  assert.throws(() =>
    telemetryRetentionDaysSchema.parse(minimumTelemetryRetentionDays - 1),
  );
  assert.throws(() =>
    telemetryRetentionDaysSchema.parse(maximumTelemetryRetentionDays + 1),
  );
});

test("repository removes expired snapshots in bounded batches", async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "palcenter-telemetry-retention-"),
  );
  const history = new SqliteHistoryRepository(directory);
  history.initialize();
  const repository = new SqliteTelemetryRepository(directory);
  repository.initialize();

  try {
    repository.insertPlayerSnapshots([
      snapshot("2026-06-01T00:00:00.000Z"),
      snapshot("2026-06-02T00:00:00.000Z"),
      snapshot("2026-06-03T00:00:00.000Z"),
      snapshot("2026-07-01T00:00:00.000Z"),
      snapshot("2026-07-28T00:00:00.000Z"),
    ]);

    assert.equal(
      repository.deleteExpiredPlayerSnapshots("2026-07-01T00:00:00.000Z", 2),
      2,
    );
    assert.equal(
      repository.deleteExpiredPlayerSnapshots("2026-07-01T00:00:00.000Z", 2),
      1,
    );
    assert.equal(
      repository.playerHistory("srv_one", "steam-user-id", {
        limit: 100,
      }).length,
      2,
    );
  } finally {
    repository.close();
    history.close();
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("service runs retention cleanup periodically with the bounded batch size", async () => {
  let currentTime = new Date("2026-07-31T12:00:00.000Z");
  const cleanupCalls: Array<{ cutoff: string; limit: number }> = [];
  const repository = {
    initialize() {},
    close() {},
    reopen() {},
    insertPlayerSnapshots() {},
    latestPlayerSnapshots() {
      return [];
    },
    playerHistory() {
      return [];
    },
    deleteExpiredPlayerSnapshots(cutoff: string, limit: number) {
      cleanupCalls.push({ cutoff, limit });
      return 0;
    },
    deleteServerData() {},
  };
  const service = new TelemetryService(
    new MemoryConnections([]),
    repository,
    new PlayerTelemetryCollector(),
    30_000,
    30,
    () => undefined,
    () => currentTime,
  );

  await service.collectAll();
  currentTime = new Date("2026-07-31T12:04:59.000Z");
  await service.collectAll();
  currentTime = new Date("2026-07-31T12:05:00.000Z");
  await service.collectAll();

  assert.deepEqual(cleanupCalls, [
    { cutoff: "2026-07-01T12:00:00.000Z", limit: 1_000 },
    { cutoff: "2026-07-01T12:05:00.000Z", limit: 1_000 },
  ]);
});

test("service skips unchanged snapshots but records movement, state, and heartbeat", async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "palcenter-telemetry-write-reduction-"),
  );
  const history = new SqliteHistoryRepository(directory);
  history.initialize();
  const repository = new SqliteTelemetryRepository(directory);
  repository.initialize();
  let currentTime = new Date("2026-07-28T12:00:00.000Z");
  let currentX = 1_000;
  let buildingCount = 3;
  const collector = new PlayerTelemetryCollector(() => ({
    getPlayers: async () =>
      response({ location_x: currentX, building_count: buildingCount }),
  }));
  const service = new TelemetryService(
    new MemoryConnections([connection("srv_one")]),
    repository,
    collector,
    30_000,
    30,
    () => undefined,
    () => currentTime,
  );
  const rows = () =>
    repository.playerHistory("srv_one", "steam-user-id", { limit: 100 });

  try {
    await service.collectAll();
    assert.equal(rows().length, 1);

    currentTime = new Date("2026-07-28T12:00:30.000Z");
    await service.collectAll();
    assert.equal(rows().length, 1, "unchanged snapshot should be skipped");

    currentX += 99;
    currentTime = new Date("2026-07-28T12:01:00.000Z");
    await service.collectAll();
    assert.equal(rows().length, 1, "sub-threshold movement should be skipped");

    currentX += 1;
    currentTime = new Date("2026-07-28T12:01:30.000Z");
    await service.collectAll();
    assert.equal(rows().length, 2, "material movement should be stored");

    buildingCount += 1;
    currentTime = new Date("2026-07-28T12:02:00.000Z");
    await service.collectAll();
    assert.equal(rows().length, 3, "state changes should be stored");

    currentTime = new Date("2026-07-28T12:07:00.000Z");
    await service.collectAll();
    assert.equal(rows().length, 4, "five-minute heartbeat should be stored");
  } finally {
    repository.close();
    history.close();
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("service collects configured servers concurrently and isolates offline failures", async () => {
  const connections = new MemoryConnections([
    connection("srv_online"),
    connection("srv_offline"),
  ]);
  const saved: NewPlayerPositionSnapshot[][] = [];
  const failures: string[] = [];
  const repository = {
    initialize() {},
    close() {},
    reopen() {},
    insertPlayerSnapshots(items: NewPlayerPositionSnapshot[]) {
      saved.push(items);
    },
    latestPlayerSnapshots() {
      return [];
    },
    playerHistory() {
      return [];
    },
    deleteExpiredPlayerSnapshots() {
      return 0;
    },
    deleteServerData() {},
  };
  const collector = new PlayerTelemetryCollector((server) => ({
    getPlayers: async () => {
      if (server.id === "srv_offline") {
        throw new Error("offline");
      }
      return response({ userId: `${server.id}-user` });
    },
  }));
  const service = new TelemetryService(
    connections,
    repository,
    collector,
    30_000,
    30,
    (serverId) => failures.push(serverId),
  );

  await service.collectAll();

  assert.equal(saved.length, 1);
  assert.equal(saved[0]?.[0]?.serverId, "srv_online");
  assert.deepEqual(failures, ["srv_offline"]);
});
