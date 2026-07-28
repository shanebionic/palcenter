import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { JsonConnectionRepository } from "../src/repositories/json-connection-repository.js";
import { SqliteAutomationRepository } from "../src/repositories/sqlite-automation-repository.js";
import { SqliteHistoryRepository } from "../src/repositories/sqlite-history-repository.js";
import { ConnectionManager } from "../src/services/connection-manager.js";
import type { StoredConnection } from "../src/types/connections.js";

const original: StoredConnection = {
  id: "srv_edit",
  name: "Original",
  baseUrl: "http://old.example:8212",
  adminPassword: "original-secret",
  createdAt: "2026-07-28T00:00:00.000Z",
  updatedAt: "2026-07-28T00:00:00.000Z",
};

test("connection updates preserve identity, credentials, and server-scoped data", async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "palcenter-edit-connection-"),
  );
  const connections = new JsonConnectionRepository(directory);
  const history = new SqliteHistoryRepository(directory);
  const automation = new SqliteAutomationRepository(directory);

  try {
    await connections.initialize();
    await connections.create(original);
    history.initialize();
    automation.initialize();
    history.saveSample(
      {
        serverId: original.id,
        status: "online",
        playerCount: 1,
        maxPlayers: 32,
        fps: 60,
        responseTimeMs: 20,
        uptimeSeconds: 100,
        capturedAt: "2026-07-28T00:01:00.000Z",
      },
      [
        {
          serverId: original.id,
          type: "player_joined",
          playerId: "player",
          playerName: "Player",
          occurredAt: "2026-07-28T00:01:00.000Z",
        },
      ],
      [{ playerId: "player", name: "Player" }],
    );
    automation.createTask({
      id: "task_connection",
      name: "Connection task",
      serverId: original.id,
      enabled: true,
      taskType: "broadcast_message",
      schedule: { type: "daily", time: "09:00" },
      timeZone: "UTC",
      configuration: { message: "Test" },
      lastRunAt: null,
      nextRunAt: "2026-07-29T09:00:00.000Z",
      lastResult: null,
      lastError: null,
      createdAt: original.createdAt,
      updatedAt: original.updatedAt,
    });

    const manager = new ConnectionManager(connections);
    const publicConnection = await manager.update(original.id, {
      name: "Updated",
      baseUrl: "https://new.example:9443/",
      adminPassword: "",
    });
    const stored = await connections.get(original.id);

    assert.equal(publicConnection.id, original.id);
    assert.equal(publicConnection.name, "Updated");
    assert.equal(publicConnection.baseUrl, "https://new.example:9443");
    assert.equal(stored?.createdAt, original.createdAt);
    assert.equal(stored?.adminPassword, original.adminPassword);
    assert.equal(history.listMetrics(original.id, 10).length, 1);
    assert.equal(history.listEvents(original.id, 10).length, 1);
    assert.equal(history.activePlayers(original.id).length, 1);
    assert.equal(automation.getTask("task_connection")?.serverId, original.id);

    await manager.update(original.id, {
      name: "Updated",
      baseUrl: "https://new.example:9443",
      adminPassword: "replacement-secret",
    });
    assert.equal(
      (await connections.get(original.id))?.adminPassword,
      "replacement-secret",
    );
    assert.equal(
      "adminPassword" in publicConnection,
      false,
      "Public responses must not expose the stored credential.",
    );
  } finally {
    automation.close();
    history.close();
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("testing an edited connection reuses the stored password when replacement is blank", async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "palcenter-test-edited-connection-"),
  );
  const connections = new JsonConnectionRepository(directory);
  const previousFetch = globalThis.fetch;
  const authorizations: string[] = [];

  try {
    await connections.initialize();
    await connections.create(original);
    globalThis.fetch = async (input, init) => {
      authorizations.push(
        new Headers(init?.headers).get("Authorization") ?? "",
      );
      const url = String(input);
      const body = url.endsWith("/info")
        ? {
            version: "v1",
            servername: "Test",
            description: "",
            worldguid: "world",
          }
        : {
            currentplayernum: 0,
            maxplayernum: 32,
            serverfps: 60,
            serverframetime: 16,
            days: 1,
            basecampnum: 0,
            uptime: 10,
          };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const result = await new ConnectionManager(connections).testUpdate(
      original.id,
      "http://new.example:8212",
      "",
    );
    assert.equal(result.info.servername, "Test");
    const expected = `Basic ${Buffer.from(`admin:${original.adminPassword}`).toString("base64")}`;
    assert.deepEqual(authorizations, [expected, expected]);
  } finally {
    globalThis.fetch = previousFetch;
    await fs.rm(directory, { recursive: true, force: true });
  }
});
