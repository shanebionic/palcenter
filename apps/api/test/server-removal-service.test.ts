import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { JsonConnectionRepository } from "../src/repositories/json-connection-repository.js";
import { SqliteHistoryRepository } from "../src/repositories/sqlite-history-repository.js";
import {
  RemovalServerNotFoundError,
  ServerRemovalService,
} from "../src/services/server-removal-service.js";
import type { StoredConnection } from "../src/types/connections.js";

const monitoring = {
  pause: async () => undefined,
  resume: () => undefined,
};

function connection(id: string, name: string): StoredConnection {
  const timestamp = "2026-07-27T12:00:00.000Z";

  return {
    id,
    name,
    baseUrl: "http://offline.example:8212",
    adminPassword: "not-used-during-removal",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

test("removes persisted connection and all server-scoped history without contacting the remote server", async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "palcenter-remove-server-"),
  );
  const connections = new JsonConnectionRepository(directory);
  const history = new SqliteHistoryRepository(directory);

  try {
    await connections.initialize();
    history.initialize();

    const removed = connection("srv_remove", "Remove Me");
    const retained = connection("srv_keep", "Keep Me");
    await connections.create(removed);
    await connections.create(retained);

    for (const server of [removed, retained]) {
      history.saveSample(
        {
          serverId: server.id,
          status: "offline",
          playerCount: 1,
          maxPlayers: 32,
          fps: 60,
          responseTimeMs: null,
          uptimeSeconds: null,
          capturedAt: "2026-07-27T12:01:00.000Z",
        },
        [
          {
            serverId: server.id,
            type: "player_joined",
            playerId: "player-1",
            playerName: "Player",
            occurredAt: "2026-07-27T12:01:00.000Z",
          },
        ],
        [{ playerId: "player-1", name: "Player" }],
      );
    }

    await new ServerRemovalService(connections, history, monitoring).remove(
      removed.id,
    );

    assert.equal(await connections.get(removed.id), null);
    assert.deepEqual(history.listMetrics(removed.id, 100), []);
    assert.deepEqual(history.listEvents(removed.id, 100), []);
    assert.deepEqual(history.activePlayers(removed.id), []);

    assert.equal((await connections.get(retained.id))?.name, retained.name);
    assert.equal(history.listMetrics(retained.id, 100).length, 1);
    assert.equal(history.listEvents(retained.id, 100).length, 1);
    assert.equal(history.activePlayers(retained.id).length, 1);

    const reopenedConnections = new JsonConnectionRepository(directory);
    assert.equal(await reopenedConnections.get(removed.id), null);
    assert.equal(
      (await reopenedConnections.get(retained.id))?.name,
      retained.name,
    );
  } finally {
    history.close();
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("returns not found without changing unrelated data", async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "palcenter-remove-missing-"),
  );
  const connections = new JsonConnectionRepository(directory);
  const history = new SqliteHistoryRepository(directory);

  try {
    await connections.initialize();
    history.initialize();
    const retained = connection("srv_keep", "Keep Me");
    await connections.create(retained);

    await assert.rejects(
      () =>
        new ServerRemovalService(connections, history, monitoring).remove(
          "srv_missing",
        ),
      RemovalServerNotFoundError,
    );
    assert.equal((await connections.get(retained.id))?.name, retained.name);
  } finally {
    history.close();
    await fs.rm(directory, { recursive: true, force: true });
  }
});
