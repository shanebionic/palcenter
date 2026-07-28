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
        location_z: 250,
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
    playerId: "steam-user-id",
    playerName: "Bob",
    capturedAt,
    x: 10,
    y: 20,
    z: null,
    level: 42,
    ping: 24,
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
    getPlayers: async () =>
      response({ name: "  Renamed Bob  ", guildName: "Explorers" }),
  }));

  const snapshots = await collector.collect(connection("srv_one"), timestamp);

  assert.deepEqual(snapshots, [
    snapshot(timestamp, {
      playerName: "Renamed Bob",
      x: 12345,
      y: -5678,
      z: 250,
      guildName: "Explorers",
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
  assert.equal(snapshots[0]?.playerId, "valid-user");
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
        playerId: "another-user",
        playerName: "Alice",
      }),
    ]);

    const latest = repository.latestPlayerSnapshots("srv_one");
    assert.equal(latest.length, 2);
    assert.equal(
      latest.find((item) => item.playerId === "steam-user-id")?.playerName,
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
    (serverId) => failures.push(serverId),
  );

  await service.collectAll();

  assert.equal(saved.length, 1);
  assert.equal(saved[0]?.[0]?.serverId, "srv_online");
  assert.deepEqual(failures, ["srv_offline"]);
});
