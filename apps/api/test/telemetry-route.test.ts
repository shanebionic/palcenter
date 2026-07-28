import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import type { FastifyInstance } from "fastify";
import { JsonConnectionRepository } from "../src/repositories/json-connection-repository.js";
import { SqliteTelemetryRepository } from "../src/telemetry/repositories/sqlite-telemetry-repository.js";

const directory = await fs.mkdtemp(
  path.join(os.tmpdir(), "palcenter-telemetry-route-"),
);

process.env.NODE_ENV = "test";
process.env.CONFIG_DIR = directory;
process.env.LOG_LEVEL = "silent";
process.env.HISTORY_INTERVAL_SECONDS = "3600";
process.env.TELEMETRY_INTERVAL_SECONDS = "3600";
process.env.AUTOMATION_INTERVAL_SECONDS = "3600";
process.env.PALCENTER_SESSION_COOKIE_SECURE = "false";

let app: FastifyInstance;
let administratorCookie: string;
let visitorCookie: string;

function cookie(response: {
  headers: Record<string, string | string[] | undefined>;
}): string {
  const header = response.headers["set-cookie"];
  assert.equal(typeof header, "string");
  return header.split(";", 1)[0];
}

async function login(username: string, password: string): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { username, password },
  });
  assert.equal(response.statusCode, 200);
  return cookie(response);
}

before(async () => {
  ({ app } = await import("../src/index.js"));
  await app.ready();

  const setup = await app.inject({
    method: "POST",
    url: "/api/auth/setup",
    payload: {
      username: "administrator",
      email: "administrator@example.com",
      password: "Administrator-Password-123!",
      passwordConfirmation: "Administrator-Password-123!",
    },
  });
  assert.equal(setup.statusCode, 201);
  administratorCookie = cookie(setup);

  const createVisitor = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: { cookie: administratorCookie },
    payload: {
      username: "visitor",
      email: "visitor@example.com",
      password: "Visitor-Password-123!",
      role: "visitor",
    },
  });
  assert.equal(createVisitor.statusCode, 201);
  const temporaryCookie = await login("visitor", "Visitor-Password-123!");
  const changePassword = await app.inject({
    method: "POST",
    url: "/api/users/me/password",
    headers: { cookie: temporaryCookie },
    payload: {
      currentPassword: "Visitor-Password-123!",
      newPassword: "Visitor-Replacement-456!",
      passwordConfirmation: "Visitor-Replacement-456!",
    },
  });
  assert.equal(changePassword.statusCode, 200);
  visitorCookie = await login("visitor", "Visitor-Replacement-456!");

  const connections = new JsonConnectionRepository(directory);
  await connections.create({
    id: "srv_telemetry",
    name: "Telemetry Server",
    baseUrl: "http://127.0.0.1:1",
    adminPassword: "not-used",
    createdAt: "2026-07-28T12:00:00.000Z",
    updatedAt: "2026-07-28T12:00:00.000Z",
  });

  const telemetry = new SqliteTelemetryRepository(directory);
  telemetry.initialize();
  telemetry.insertPlayerSnapshots([
    {
      serverId: "srv_telemetry",
      playerId: "player-one",
      playerName: "Bob",
      capturedAt: "2026-07-28T12:00:00.000Z",
      x: 100,
      y: 200,
      z: null,
      level: 10,
      ping: 20,
      guildId: null,
      guildName: null,
    },
  ]);
  telemetry.close();
});

after(async () => {
  await app.close();
  await fs.rm(directory, { recursive: true, force: true });
});

test("telemetry routes require authentication", async () => {
  const response = await app.inject({
    method: "GET",
    url: "/api/servers/srv_telemetry/telemetry/players/latest",
  });
  assert.equal(response.statusCode, 401);
});

test("visitor can read latest player telemetry with normalized response", async () => {
  const response = await app.inject({
    method: "GET",
    url: "/api/servers/srv_telemetry/telemetry/players/latest",
    headers: { cookie: visitorCookie },
  });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.players.length, 1);
  assert.equal(body.players[0].playerId, "player-one");
  assert.equal(body.players[0].x, 100);
  assert.equal("adminPassword" in body.players[0], false);
});

test("history supports time ranges and bounded limits", async () => {
  const response = await app.inject({
    method: "GET",
    url:
      "/api/servers/srv_telemetry/telemetry/players/player-one/history" +
      "?from=2026-07-28T11%3A00%3A00.000Z" +
      "&to=2026-07-28T13%3A00%3A00.000Z&limit=10",
    headers: { cookie: administratorCookie },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().snapshots.length, 1);
});

test("telemetry routes return server_not_found for unknown server IDs", async () => {
  const response = await app.inject({
    method: "GET",
    url: "/api/servers/unknown/telemetry/players/latest",
    headers: { cookie: administratorCookie },
  });
  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error, "server_not_found");
});
