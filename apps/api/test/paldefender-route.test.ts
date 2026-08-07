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
