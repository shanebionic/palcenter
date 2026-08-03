import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import type { ConnectionRepository } from "../src/repositories/connection-repository.js";
import { SqliteHistoryRepository } from "../src/repositories/sqlite-history-repository.js";
import { SqliteWorldEventRepository } from "../src/repositories/sqlite-world-event-repository.js";
import { WorldEventService } from "../src/services/world-event-service.js";
import type { StoredConnection } from "../src/types/connections.js";

const connection: StoredConnection = {
  id: "srv_events",
  name: "Palpagos",
  baseUrl: "http://palworld.example:8212",
  adminPassword: "not-used",
};

const connections: ConnectionRepository = {
  async initialize() {},
  async list() {
    return [connection];
  },
  async get(id) {
    return id === connection.id ? connection : null;
  },
  async create() {},
  async update() {},
  async delete() {},
};

function fixture(
  companion?: ConstructorParameters<typeof WorldEventService>[2],
) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "palcenter-world-events-"),
  );
  const history = new SqliteHistoryRepository(directory);
  history.initialize();
  const repository = new SqliteWorldEventRepository(directory);
  repository.initialize();
  return {
    directory,
    history,
    repository,
    service: new WorldEventService(connections, repository, companion),
  };
}

test("Companion activity replaces matching REST inference without duplicates", async () => {
  const companion = {
    async activity() {
      return [
        {
          eventId: "event-one",
          eventType: "player_joined" as const,
          timestamp: "2026-08-03T12:00:10.000Z",
          serverInstanceId: "instance-one",
          player: { userId: "user-1", playerId: "player-1", name: "Denalb" },
          sessionId: "session-one",
          source: "palworld_server_hook" as const,
          schemaVersion: "1" as const,
          durationSeconds: null,
          metadata: {},
        },
      ];
    },
  };
  const context = fixture(companion);
  try {
    context.service.recordServerEvents([
      {
        id: 1,
        serverId: connection.id,
        type: "player_joined",
        playerId: "user-1",
        playerName: "Denalb",
        occurredAt: "2026-08-03T12:00:00.000Z",
      },
    ]);
    const first = await context.service.list(connection.id, { limit: 100 });
    const second = await context.service.list(connection.id, { limit: 100 });
    assert.equal(
      first.filter(({ type }) => type === "player_joined").length,
      1,
    );
    assert.equal(
      first.find(({ type }) => type === "player_joined")?.id,
      "companion_event-one",
    );
    assert.equal(
      second.filter(({ id }) => id === "companion_event-one").length,
      1,
    );
    assert.equal(
      first.find(({ id }) => id === "companion_event-one")?.metadata.playerName,
      "Denalb",
    );
  } finally {
    context.repository.close();
    context.history.close();
    fs.rmSync(context.directory, { recursive: true, force: true });
  }
});

test("background Companion sync stores completed session duration", async () => {
  const companion = {
    async activity() {
      return [
        {
          eventId: "event-ended",
          eventType: "session_ended" as const,
          timestamp: "2026-08-03T12:02:10.000Z",
          serverInstanceId: "instance-one",
          player: { userId: null, playerId: "player-1", name: "Denalb" },
          sessionId: "session-one",
          source: "palworld_server_hook" as const,
          schemaVersion: "1" as const,
          durationSeconds: 130,
          metadata: {},
        },
      ];
    },
  };
  const context = fixture(companion);
  try {
    await context.service.syncCompanion(connection.id);
    const stored = context.repository.list(connection.id, { limit: 10 });
    assert.equal(stored.length, 1);
    assert.equal(stored[0]?.id, "companion_event-ended");
    assert.equal(stored[0]?.metadata.durationSeconds, 130);
    assert.equal(stored[0]?.metadata.sessionId, "session-one");
  } finally {
    context.repository.close();
    context.history.close();
    fs.rmSync(context.directory, { recursive: true, force: true });
  }
});

test("join and disconnect observations produce deterministic session events", () => {
  const context = fixture();
  try {
    const joined = context.service.recordServerEvents([
      {
        id: 1,
        serverId: connection.id,
        type: "player_joined",
        playerId: "user-1",
        playerName: "Denalb",
        occurredAt: "2026-07-30T12:00:00.000Z",
      },
    ]);
    assert.deepEqual(
      joined.map((event) => event.type),
      ["player_joined", "session_started"],
    );
    assert.ok(joined.every((event) => event.confidence === 1));
    assert.deepEqual(joined[0]?.evidence, [
      { source: "players", fact: "appeared", value: "online_roster" },
    ]);
    assert.equal(joined[0]?.metadata.playerName, "Denalb");

    const disconnected = context.service.recordServerEvents([
      {
        id: 2,
        serverId: connection.id,
        type: "player_left",
        playerId: "user-1",
        playerName: "Renamed",
        occurredAt: "2026-07-30T13:00:00.000Z",
      },
    ]);
    assert.deepEqual(
      disconnected.map((event) => event.type),
      ["player_disconnected", "session_ended"],
    );
    assert.equal(disconnected[0]?.metadata.playerName, "Renamed");
  } finally {
    context.repository.close();
    context.history.close();
    fs.rmSync(context.directory, { recursive: true, force: true });
  }
});

test("event IDs make repeated observations idempotent", () => {
  const context = fixture();
  const source = {
    id: 1,
    serverId: connection.id,
    type: "player_joined" as const,
    playerId: "user-1",
    playerName: "Denalb",
    occurredAt: "2026-07-30T12:00:00.000Z",
  };
  try {
    assert.equal(context.service.recordServerEvents([source]).length, 2);
    assert.equal(context.service.recordServerEvents([source]).length, 0);
    assert.equal(
      context.repository.list(connection.id, { limit: 10 }).length,
      2,
    );
  } finally {
    context.repository.close();
    context.history.close();
    fs.rmSync(context.directory, { recursive: true, force: true });
  }
});

test("repository serializes metadata and evidence and returns chronological history", () => {
  const context = fixture();
  try {
    context.service.recordServerEvents([
      {
        id: 2,
        serverId: connection.id,
        type: "player_left",
        playerId: "user-1",
        playerName: "Latest Name",
        occurredAt: "2026-07-30T13:00:00.000Z",
      },
      {
        id: 1,
        serverId: connection.id,
        type: "player_joined",
        playerId: "user-1",
        playerName: "Original Name",
        occurredAt: "2026-07-30T12:00:00.000Z",
      },
    ]);
    const events = context.repository.list(connection.id, {
      userId: "user-1",
      limit: 3,
    });
    assert.equal(events.length, 3);
    assert.deepEqual(
      events.map((event) => event.timestamp),
      [...events.map((event) => event.timestamp)].sort(),
    );
    assert.equal(events[0]?.metadata.playerName, "Original Name");
    assert.equal(events.at(-1)?.metadata.playerName, "Latest Name");
    assert.deepEqual(events.at(-1)?.evidence, [
      { source: "players", fact: "disappeared", value: "online_roster" },
    ]);
    assert.deepEqual(
      context.repository
        .list(connection.id, { type: "session_started", limit: 10 })
        .map(({ type }) => type),
      ["session_started"],
    );
  } finally {
    context.repository.close();
    context.history.close();
    fs.rmSync(context.directory, { recursive: true, force: true });
  }
});

test("non-player, missing-identity, and unrelated player events are ignored", () => {
  const context = fixture();
  try {
    const generated = context.service.recordServerEvents([
      {
        id: 1,
        serverId: connection.id,
        type: "server_online",
        playerId: null,
        playerName: null,
        occurredAt: "2026-07-30T12:00:00.000Z",
      },
      {
        id: 2,
        serverId: connection.id,
        type: "player_banned",
        playerId: "user-1",
        playerName: "Denalb",
        occurredAt: "2026-07-30T12:01:00.000Z",
      },
    ]);
    assert.deepEqual(generated, []);
  } finally {
    context.repository.close();
    context.history.close();
    fs.rmSync(context.directory, { recursive: true, force: true });
  }
});

test("schema version 7 checkpoints migrate through coordinate-aware schema version 9", () => {
  const context = fixture();
  context.repository.append([
    {
      id: "wie_existing",
      serverId: connection.id,
      userId: "user-1",
      playerId: null,
      timestamp: "2026-07-30T12:00:00.000Z",
      type: "player_joined",
      metadata: {},
      confidence: 1,
      evidence: [],
      position: null,
    },
  ]);
  context.repository.commitActivityObservation(
    connection.id,
    [
      {
        serverId: connection.id,
        userId: "user-1",
        playerId: null,
        playerName: "Denalb",
        state: "active",
        anchorAt: "2026-07-30T12:00:00.000Z",
        anchorX: 0,
        anchorY: 0,
        lastSampleAt: "2026-07-30T12:00:00.000Z",
        lastX: 0,
        lastY: 0,
        coordinateSpaceId: "palpagos",
      },
    ],
    [],
  );
  context.repository.close();
  context.history.close();
  const databasePath = path.join(context.directory, "history.sqlite");
  const database = new DatabaseSync(databasePath);
  database.exec(`
    ALTER TABLE world_player_activity_state DROP COLUMN coordinate_space_id;
    ALTER TABLE player_position_snapshots DROP COLUMN coordinate_space_id;
    PRAGMA user_version = 7;
  `);
  database.close();

  const migratedHistory = new SqliteHistoryRepository(context.directory);
  const migratedEvents = new SqliteWorldEventRepository(context.directory);
  try {
    migratedHistory.initialize();
    migratedEvents.initialize();
    assert.equal(
      migratedEvents.list(connection.id, { limit: 10 })[0]?.id,
      "wie_existing",
    );
    const migrated = new DatabaseSync(databasePath, { readOnly: true });
    const version = migrated.prepare("PRAGMA user_version").get() as {
      user_version: number;
    };
    const activityTable = migrated
      .prepare(
        "SELECT name FROM sqlite_master WHERE name = 'world_player_activity_state'",
      )
      .get();
    const activityColumns = migrated
      .prepare("PRAGMA table_info(world_player_activity_state)")
      .all() as unknown as Array<{ name: string }>;
    const telemetryColumns = migrated
      .prepare("PRAGMA table_info(player_position_snapshots)")
      .all() as unknown as Array<{ name: string }>;
    migrated.close();
    assert.equal(version.user_version, 9);
    assert.ok(activityTable);
    assert.ok(
      activityColumns.some(({ name }) => name === "coordinate_space_id"),
    );
    assert.ok(
      telemetryColumns.some(({ name }) => name === "coordinate_space_id"),
    );
    assert.equal(
      migratedEvents.activityStates(connection.id)[0]?.coordinateSpaceId,
      "unknown",
    );
  } finally {
    migratedEvents.close();
    migratedHistory.close();
    fs.rmSync(context.directory, { recursive: true, force: true });
  }
});
