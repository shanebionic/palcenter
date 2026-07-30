import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
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

function fixture() {
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
    service: new WorldEventService(connections, repository),
  };
}

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
