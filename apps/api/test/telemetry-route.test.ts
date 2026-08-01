import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import type { FastifyInstance } from "fastify";
import { JsonConnectionRepository } from "../src/repositories/json-connection-repository.js";
import { SqliteWorldEventRepository } from "../src/repositories/sqlite-world-event-repository.js";
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
let moderatorCookie: string;
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

  async function createUser(
    username: string,
    role: "moderator" | "visitor",
  ): Promise<string> {
    const initialPassword = `${username}-Password-123!`;
    const replacementPassword = `${username}-Replacement-456!`;
    const create = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: { cookie: administratorCookie },
      payload: {
        username,
        email: `${username}@example.com`,
        password: initialPassword,
        role,
      },
    });
    assert.equal(create.statusCode, 201);
    const temporaryCookie = await login(username, initialPassword);
    const changePassword = await app.inject({
      method: "POST",
      url: "/api/users/me/password",
      headers: { cookie: temporaryCookie },
      payload: {
        currentPassword: initialPassword,
        newPassword: replacementPassword,
        passwordConfirmation: replacementPassword,
      },
    });
    assert.equal(changePassword.statusCode, 200);
    return login(username, replacementPassword);
  }

  moderatorCookie = await createUser("moderator", "moderator");
  visitorCookie = await createUser("visitor", "visitor");

  const connections = new JsonConnectionRepository(directory);
  await connections.create({
    id: "srv_telemetry",
    name: "Telemetry Server",
    baseUrl: "http://127.0.0.1:1",
    adminPassword: "not-used",
    createdAt: "2026-07-28T12:00:00.000Z",
    updatedAt: "2026-07-28T12:00:00.000Z",
  });
  await connections.create({
    id: "srv_isolated",
    name: "Isolated Server",
    baseUrl: "http://127.0.0.1:2",
    adminPassword: "not-used",
    createdAt: "2026-07-28T12:00:00.000Z",
    updatedAt: "2026-07-28T12:00:00.000Z",
  });

  const telemetry = new SqliteTelemetryRepository(directory);
  telemetry.initialize();
  telemetry.insertPlayerSnapshots([
    {
      serverId: "srv_telemetry",
      userId: "user-one",
      playerId: "player-one",
      playerName: "Bob",
      accountName: "bob-account",
      capturedAt: "2026-07-28T12:00:00.000Z",
      x: 100,
      y: 200,
      z: null,
      level: 10,
      ping: 20,
      buildingCount: 2,
      guildId: null,
      guildName: null,
    },
    {
      serverId: "srv_telemetry",
      userId: "user-one",
      playerId: "player-one",
      playerName: "Bob",
      accountName: "bob-account",
      capturedAt: "2026-07-28T12:01:00.000Z",
      x: 150,
      y: 250,
      z: null,
      level: 10,
      ping: 20,
      buildingCount: 2,
      guildId: null,
      guildName: null,
    },
    {
      serverId: "srv_isolated",
      userId: "user-one",
      playerId: "other-player",
      playerName: "Private",
      accountName: "private-account",
      capturedAt: "2026-07-28T12:02:00.000Z",
      x: 999,
      y: 999,
      z: null,
      level: 50,
      ping: 1,
      buildingCount: 99,
      guildId: null,
      guildName: null,
    },
  ]);
  telemetry.close();

  const worldEvents = new SqliteWorldEventRepository(directory);
  worldEvents.initialize();
  worldEvents.append([
    {
      id: "wie_route_1",
      serverId: "srv_telemetry",
      userId: "user-one",
      playerId: "player-one",
      timestamp: "2026-07-28T12:03:00.000Z",
      type: "player_joined",
      metadata: { playerName: "Bob" },
      confidence: 1,
      evidence: [
        { source: "players", fact: "appeared", value: "online_roster" },
      ],
      position: null,
    },
  ]);
  worldEvents.close();
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
  assert.equal(body.players[0].userId, "user-one");
  assert.equal(body.players[0].playerId, "player-one");
  assert.equal(body.players[0].accountName, "bob-account");
  assert.equal(body.players[0].buildingCount, 2);
  assert.equal(body.pollingIntervalSeconds, 3600);
  assert.equal(body.lastCollectedAt, null);
  assert.equal(body.players[0].x, 150);
  assert.equal("adminPassword" in body.players[0], false);
  assert.equal("ip" in body.players[0], false);
});

test("history supports time ranges and bounded limits", async () => {
  const response = await app.inject({
    method: "GET",
    url:
      "/api/servers/srv_telemetry/telemetry/players/user-one/history" +
      "?start=2026-07-28T11%3A00%3A00.000Z" +
      "&end=2026-07-28T13%3A00%3A00.000Z&limit=1",
    headers: { cookie: administratorCookie },
  });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.points.length, 1);
  assert.equal(body.points[0].capturedAt, "2026-07-28T12:01:00.000Z");
  assert.equal(body.truncated, true);
  assert.deepEqual(Object.keys(body.points[0]).sort(), [
    "capturedAt",
    "coordinateSpaceId",
    "x",
    "y",
  ]);
});

test("Administrator and Moderator can read trails while Visitor cannot", async () => {
  const url =
    "/api/servers/srv_telemetry/telemetry/players/user-one/history" +
    "?start=2026-07-28T11%3A00%3A00.000Z&end=2026-07-28T13%3A00%3A00.000Z";
  for (const roleCookie of [administratorCookie, moderatorCookie]) {
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url,
          headers: { cookie: roleCookie },
        })
      ).statusCode,
      200,
    );
  }
  assert.equal(
    (
      await app.inject({
        method: "GET",
        url,
        headers: { cookie: visitorCookie },
      })
    ).statusCode,
    403,
  );
});

test("history is chronological, range filtered, private, and server isolated", async () => {
  const response = await app.inject({
    method: "GET",
    url:
      "/api/servers/srv_telemetry/telemetry/players/user-one/history" +
      "?start=2026-07-28T11%3A00%3A00.000Z&end=2026-07-28T12%3A00%3A30.000Z",
    headers: { cookie: moderatorCookie },
  });
  const body = response.json();
  assert.equal(response.statusCode, 200);
  assert.deepEqual(
    body.points.map((point: { capturedAt: string }) => point.capturedAt),
    ["2026-07-28T12:00:00.000Z"],
  );
  assert.equal(JSON.stringify(body).includes("private-account"), false);
  assert.equal(JSON.stringify(body).includes("not-used"), false);
});

test("history returns empty points and validates identifiers and ranges", async () => {
  const base =
    "?start=2026-07-28T11%3A00%3A00.000Z&end=2026-07-28T13%3A00%3A00.000Z";
  const empty = await app.inject({
    method: "GET",
    url: `/api/servers/srv_telemetry/telemetry/players/nobody/history${base}`,
    headers: { cookie: moderatorCookie },
  });
  assert.equal(empty.statusCode, 200);
  assert.deepEqual(empty.json().points, []);

  const invalid = await app.inject({
    method: "GET",
    url: `/api/servers/srv_telemetry/telemetry/players/%20/history${base}`,
    headers: { cookie: moderatorCookie },
  });
  assert.equal(invalid.statusCode, 400);

  const tooLong = await app.inject({
    method: "GET",
    url:
      "/api/servers/srv_telemetry/telemetry/players/user-one/history" +
      "?start=2026-07-27T11%3A00%3A00.000Z&end=2026-07-28T13%3A00%3A00.000Z",
    headers: { cookie: moderatorCookie },
  });
  assert.equal(tooLong.statusCode, 400);
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

test("world event history is authenticated, chronological, bounded, and role protected", async () => {
  const unauthenticated = await app.inject({
    method: "GET",
    url: "/api/servers/srv_telemetry/world-events",
  });
  assert.equal(unauthenticated.statusCode, 401);

  for (const roleCookie of [administratorCookie, moderatorCookie]) {
    const response = await app.inject({
      method: "GET",
      url: "/api/servers/srv_telemetry/world-events?userId=user-one&limit=1",
      headers: { cookie: roleCookie },
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().events[0].id, "wie_route_1");
    assert.equal(JSON.stringify(response.json()).includes("not-used"), false);
  }

  const visitor = await app.inject({
    method: "GET",
    url: "/api/servers/srv_telemetry/world-events",
    headers: { cookie: visitorCookie },
  });
  assert.equal(visitor.statusCode, 403);

  const unknown = await app.inject({
    method: "GET",
    url: "/api/servers/unknown/world-events",
    headers: { cookie: administratorCookie },
  });
  assert.equal(unknown.statusCode, 404);
  assert.equal(unknown.json().error, "server_not_found");
});
