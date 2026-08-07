import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import type { FastifyInstance } from "fastify";

const directory = await fs.mkdtemp(
  path.join(os.tmpdir(), "palcenter-pd-route-"),
);
process.env.NODE_ENV = "test";
process.env.CONFIG_DIR = directory;
process.env.LOG_LEVEL = "silent";
process.env.HISTORY_INTERVAL_SECONDS = "3600";
process.env.PALDEFENDER_URL = "http://paldefender";
process.env.PALDEFENDER_TOKEN = "route-test-token";

let app: FastifyInstance;
let administratorCookie = "";
const originalFetch = globalThis.fetch;

function cookie(response: {
  headers: Record<string, string | string[] | undefined>;
}) {
  const value = response.headers["set-cookie"];
  assert.equal(typeof value, "string");
  return value.split(";", 1)[0];
}

before(async () => {
  globalThis.fetch = async (input, init) => {
    assert.equal(
      new Headers(init?.headers).get("Authorization"),
      "Bearer route-test-token",
    );
    const url = String(input);
    if (url.endsWith("/kick/offline")) {
      return Response.json(
        { Error: { Code: "PLAYER_NOT_FOUND", Message: "Not online" } },
        { status: 404 },
      );
    }
    if (url.endsWith("/kick/player-1")) {
      assert.equal(init?.method, "POST");
      assert.equal(init?.body, JSON.stringify({ Reason: "Please reconnect" }));
      return Response.json({ Success: true, UserId: "steam_private" });
    }
    if (url.endsWith("/ban/player-1")) {
      assert.equal(init?.method, "POST");
      assert.equal(
        init?.body,
        JSON.stringify({ Reason: "Repeated abuse", IP: true }),
      );
      return Response.json({
        Success: true,
        UserId: "steam_private",
        IP: true,
        BannedIP: "192.0.2.1",
        Kicked: 1,
      });
    }
    if (url.endsWith("/ban/no-ip")) {
      return Response.json(
        { Error: { Code: "IP_UNAVAILABLE", Message: "IP unavailable" } },
        { status: 400 },
      );
    }
    if (url.endsWith("/ban/rejected")) {
      return Response.json(
        { Error: { Code: "REQUEST_FAILED", Message: "Ban was rejected" } },
        { status: 400 },
      );
    }
    if (url.endsWith("/Broadcast")) {
      assert.equal(init?.method, "POST");
      const body = JSON.parse(String(init?.body)) as { Message: string };
      if (body.Message === "fail") {
        return Response.json(
          {
            Error: {
              Code: "BROADCAST_FAILED",
              Message: "Broadcast failed",
            },
          },
          { status: 400 },
        );
      }
      assert.equal(body.Message, "Hello, Palpagos! ⚡");
      return Response.json({ Success: true });
    }
    if (url.endsWith("/guilds")) {
      return Response.json({
        Meta: { GuildCount: 1 },
        Guilds: {
          "guild-1": {
            name: "Pal Tamers",
            Level: 2,
            admin: { id: "player-1", name: "Explorer" },
            camp_count: 1,
            camps: [
              {
                id: "base-1",
                world_pos: { x: 1, y: 2, z: 3 },
                map_pos: { x: 4, y: 5, z: 6 },
              },
            ],
            member_count: 1,
            members: ["player-1"],
          },
        },
      });
    }
    if (url.endsWith("/player/missing")) {
      return Response.json(
        { Error: { Code: "PLAYER_NOT_FOUND", Message: "Missing" } },
        { status: 404 },
      );
    }
    if (url.includes("/player/"))
      return Response.json({
        Player: { Name: "Player", PlayerUID: "player-1", Status: "Online" },
      });
    if (url.includes("/items/"))
      return Response.json({
        Inventory: {
          Items: {
            Available: true,
            Slots: { "0": { ItemID: "Wood", Count: 3 } },
          },
        },
      });
    if (url.includes("/pals/"))
      return Response.json({ Pals: { Team: {}, Palbox: {}, BaseCamps: [] } });
    if (url.includes("/techs/"))
      return Response.json({ Techs: { Unlocked: ["Technology_Wood"] } });
    throw new Error(`Unexpected request: ${url}`);
  };
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
});

after(async () => {
  globalThis.fetch = originalFetch;
  await app.close();
  await fs.rm(directory, { recursive: true, force: true });
});

test("PalDefender player workspace routes require PalCenter authentication", async () => {
  const response = await app.inject({
    method: "GET",
    url: "/api/paldefender/players/player-1",
  });
  assert.equal(response.statusCode, 401);
  const kick = await app.inject({
    method: "POST",
    url: "/api/paldefender/players/player-1/kick",
    payload: {},
  });
  assert.equal(kick.statusCode, 401);
  const ban = await app.inject({
    method: "POST",
    url: "/api/paldefender/players/player-1/ban",
    payload: {},
  });
  assert.equal(ban.statusCode, 401);
  const broadcast = await app.inject({
    method: "POST",
    url: "/api/paldefender/broadcast",
    payload: { message: "Hello" },
  });
  assert.equal(broadcast.statusCode, 401);
  const guilds = await app.inject({
    method: "GET",
    url: "/api/paldefender/guilds",
  });
  assert.equal(guilds.statusCode, 401);
  const bases = await app.inject({
    method: "GET",
    url: "/api/paldefender/bases",
  });
  assert.equal(bases.statusCode, 401);
});

test("PalDefender guild route returns PalCenter-owned models", async () => {
  const response = await app.inject({
    method: "GET",
    url: "/api/paldefender/guilds",
    headers: { cookie: administratorCookie },
  });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    guilds: [
      {
        guildId: "guild-1",
        name: "Pal Tamers",
        level: 2,
        administrator: { playerId: "player-1", name: "Explorer" },
        baseCount: 1,
        camps: [
          {
            id: "base-1",
            worldPosition: { x: 1, y: 2, z: 3 },
            mapPosition: { x: 4, y: 5, z: 6 },
          },
        ],
        memberCount: 1,
        memberIds: ["player-1"],
      },
    ],
  });
});

test("PalDefender base route aggregates documented guild camps", async () => {
  const response = await app.inject({
    method: "GET",
    url: "/api/paldefender/bases",
    headers: { cookie: administratorCookie },
  });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    bases: [
      {
        baseId: "base-1",
        guildId: "guild-1",
        guildName: "Pal Tamers",
        guildAdministrator: { playerId: "player-1", name: "Explorer" },
        worldPosition: { x: 1, y: 2, z: 3 },
        mapPosition: { x: 4, y: 5, z: 6 },
      },
    ],
  });
});

test("PalDefender kick route normalizes success and offline errors", async () => {
  const headers = { cookie: administratorCookie };
  const kicked = await app.inject({
    method: "POST",
    url: "/api/paldefender/players/player-1/kick",
    headers,
    payload: { message: "Please reconnect" },
  });
  assert.equal(kicked.statusCode, 200);
  assert.deepEqual(kicked.json(), { success: true, playerId: "player-1" });

  const offline = await app.inject({
    method: "POST",
    url: "/api/paldefender/players/offline/kick",
    headers,
    payload: {},
  });
  assert.equal(offline.statusCode, 404);
  assert.deepEqual(offline.json(), {
    error: "paldefender_player_offline",
    message: "This player is no longer online and cannot be kicked.",
  });
});

test("PalDefender broadcast validates and normalizes messages and failures", async () => {
  const headers = { cookie: administratorCookie };
  const sent = await app.inject({
    method: "POST",
    url: "/api/paldefender/broadcast",
    headers,
    payload: { message: "Hello, Palpagos! ⚡" },
  });
  assert.equal(sent.statusCode, 200);
  assert.deepEqual(sent.json(), { success: true });

  for (const message of ["", "   \n\t"]) {
    const invalid = await app.inject({
      method: "POST",
      url: "/api/paldefender/broadcast",
      headers,
      payload: { message },
    });
    assert.equal(invalid.statusCode, 400);
  }

  const failed = await app.inject({
    method: "POST",
    url: "/api/paldefender/broadcast",
    headers,
    payload: { message: "fail" },
  });
  assert.equal(failed.statusCode, 400);
  assert.deepEqual(failed.json(), {
    error: "paldefender_request_failed",
    message: "Broadcast failed",
  });
});

test("PalDefender ban route normalizes success and unavailable IP errors", async () => {
  const headers = { cookie: administratorCookie };
  const banned = await app.inject({
    method: "POST",
    url: "/api/paldefender/players/player-1/ban",
    headers,
    payload: { reason: "Repeated abuse", ipBan: true },
  });
  assert.equal(banned.statusCode, 200);
  assert.deepEqual(banned.json(), {
    success: true,
    playerId: "player-1",
    ipBanned: true,
    bannedIp: "192.0.2.1",
    kickedPlayers: 1,
  });

  const unavailableIp = await app.inject({
    method: "POST",
    url: "/api/paldefender/players/no-ip/ban",
    headers,
    payload: { ipBan: true },
  });
  assert.equal(unavailableIp.statusCode, 400);
  assert.deepEqual(unavailableIp.json(), {
    error: "paldefender_ip_unavailable",
    message:
      "PalDefender could not resolve an IP address for this player. Disable IP Ban and try again.",
  });

  const rejected = await app.inject({
    method: "POST",
    url: "/api/paldefender/players/rejected/ban",
    headers,
    payload: {},
  });
  assert.equal(rejected.statusCode, 400);
  assert.deepEqual(rejected.json(), {
    error: "paldefender_request_failed",
    message: "Ban was rejected",
  });
});

test("PalDefender player workspace routes return normalized models", async () => {
  const headers = { cookie: administratorCookie };
  const detail = await app.inject({
    method: "GET",
    url: "/api/paldefender/players/player-1",
    headers,
  });
  assert.equal(detail.statusCode, 200);
  assert.deepEqual(detail.json(), {
    name: "Player",
    playerId: "player-1",
    online: true,
    guild: null,
    level: null,
    worldLocation: null,
    mapLocation: null,
  });
  const inventory = await app.inject({
    method: "GET",
    url: "/api/paldefender/players/player-1/inventory",
    headers,
  });
  assert.deepEqual(inventory.json().items, [
    { container: "Items", slot: 0, itemId: "Wood", quantity: 3 },
  ]);
  const pals = await app.inject({
    method: "GET",
    url: "/api/paldefender/players/player-1/pals",
    headers,
  });
  assert.deepEqual(pals.json(), { pals: [] });
  const technology = await app.inject({
    method: "GET",
    url: "/api/paldefender/players/player-1/technology",
    headers,
  });
  assert.deepEqual(technology.json(), { technologies: ["Technology_Wood"] });
});

test("PalDefender not-found and invalid player identifiers are normalized", async () => {
  const headers = { cookie: administratorCookie };
  const missing = await app.inject({
    method: "GET",
    url: "/api/paldefender/players/missing",
    headers,
  });
  assert.equal(missing.statusCode, 404);
  assert.equal(missing.json().error, "paldefender_player_not_found");
  const invalid = await app.inject({
    method: "GET",
    url: "/api/paldefender/players/bad%2Fid",
    headers,
  });
  assert.equal(invalid.statusCode, 400);
});
