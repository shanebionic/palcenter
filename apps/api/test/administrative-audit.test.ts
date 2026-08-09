import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { FastifyRequest } from "fastify";
import { SqliteHistoryRepository } from "../src/repositories/sqlite-history-repository.js";
import { administrativeAuditEntry } from "../src/services/administrative-audit-service.js";

test("persists administrative audit entries with server isolation and filters", async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "palcenter-audit-"),
  );
  const repository = new SqliteHistoryRepository(directory);
  repository.initialize();
  repository.appendAudit({
    serverId: "server-a",
    actorUserId: "user-1",
    actorUsername: "admin",
    occurredAt: "2026-08-08T12:00:00.000Z",
    action: "save_world",
    category: "server",
    targetType: null,
    targetId: null,
    result: "success",
    details: {},
  });
  repository.appendAudit({
    serverId: "server-b",
    actorUserId: "user-2",
    actorUsername: "moderator",
    occurredAt: "2026-08-08T12:01:00.000Z",
    action: "kick_player",
    category: "moderation",
    targetType: "player",
    targetId: "player-1",
    result: "failed",
    details: {},
  });
  assert.deepEqual(
    repository
      .listAudit("server-a", { limit: 20 })
      .map((entry) => entry.action),
    ["save_world"],
  );
  assert.equal(
    repository.listAudit("server-b", {
      category: "moderation",
      result: "failed",
      limit: 20,
    }).length,
    1,
  );
  repository.deleteServerData("server-a");
  assert.equal(repository.listAudit("server-a", { limit: 20 }).length, 0);
  repository.close();
  await fs.rm(directory, { recursive: true, force: true });
});

test("audit extraction omits sensitive request content", () => {
  const request = {
    method: "POST",
    routeOptions: { url: "/api/servers/:serverId/paldefender/player-message" },
    params: { serverId: "server-a" },
    body: {
      playerIds: ["one"],
      sendType: "PlayerChat",
      message: "private text",
      token: "secret",
    },
  } as unknown as FastifyRequest;
  const entry = administrativeAuditEntry(request, 200, {
    id: "user-1",
    username: "admin",
  });
  assert.equal(entry?.action, "send_player_message");
  assert.deepEqual(entry?.details, {
    recipientCount: 1,
    messageType: "PlayerChat",
  });
  assert.equal(JSON.stringify(entry).includes("private text"), false);
  assert.equal(JSON.stringify(entry).includes("secret"), false);
});
