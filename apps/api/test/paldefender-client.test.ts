import assert from "node:assert/strict";
import test from "node:test";
import { PalDefenderClient } from "../src/clients/paldefender-client.js";

test("gets the PalDefender version with bearer authentication", async () => {
  let requestedUrl = "";
  let authorization = "";
  const client = new PalDefenderClient(
    "http://127.0.0.1:17993/",
    "secret-token",
    async (input, init) => {
      requestedUrl = String(input);
      authorization = new Headers(init?.headers).get("Authorization") ?? "";
      return Response.json({
        Version: { Version: "1.8.0", VersionLong: "1.8.0 Beta 4" },
      });
    },
  );

  assert.equal(await client.getVersion(), "1.8.0");
  assert.equal(requestedUrl, "http://127.0.0.1:17993/v1/pdapi/version");
  assert.equal(authorization, "Bearer secret-token");
});

test("normalizes PalDefender players without leaking raw DTO fields", async () => {
  const client = new PalDefenderClient(
    "http://paldefender",
    "token",
    async () =>
      Response.json({
        Meta: { PlayerCount: 2, OnlineCount: 1 },
        Players: [
          {
            Name: "LamballFan",
            IP: "192.0.2.10",
            PlayerUID: "player-1",
            UserId: "steam_1",
            GuildName: "Pal Tamers",
            GuildUUID: "guild-1",
            Status: "Online",
          },
          {
            Name: "CattivaFan",
            PlayerUID: "player-2",
            Status: "Offline",
          },
        ],
      }),
  );

  assert.deepEqual(await client.getPlayers(), [
    {
      name: "LamballFan",
      playerId: "player-1",
      online: true,
      guild: "Pal Tamers",
      level: null,
    },
    {
      name: "CattivaFan",
      playerId: "player-2",
      online: false,
      guild: null,
      level: null,
    },
  ]);
});

test("normalizes player details and omits raw platform and network identifiers", async () => {
  const client = new PalDefenderClient(
    "http://paldefender",
    "token",
    async () =>
      Response.json({
        Player: {
          Name: "Explorer",
          IP: "192.0.2.1",
          PlayerUID: "player-1",
          UserId: "gdk_secret",
          GuildName: "Guild",
          GuildUUID: "guild-secret",
          Status: "Online",
          WorldLocation: { x: 1, y: 2, z: 3 },
          MapLocation: { x: 4, y: 5 },
        },
      }),
  );
  assert.deepEqual(await client.getPlayer("player-1"), {
    name: "Explorer",
    playerId: "player-1",
    online: true,
    guild: "Guild",
    level: null,
    worldLocation: { x: 1, y: 2, z: 3 },
    mapLocation: { x: 4, y: 5 },
  });
});

test("flattens available inventory containers into PalCenter items", async () => {
  const client = new PalDefenderClient(
    "http://paldefender",
    "token",
    async () =>
      Response.json({
        Inventory: {
          Items: {
            Available: true,
            Slots: { "2": { ItemID: "Wood", Count: 12 } },
          },
          Armor: { Available: false, Slots: {} },
        },
      }),
  );
  assert.deepEqual(await client.getInventory("player-1"), [
    { container: "Items", slot: 2, itemId: "Wood", quantity: 12 },
  ]);
});

test("normalizes team, Palbox, and base-camp Pals", async () => {
  const client = new PalDefenderClient(
    "http://paldefender",
    "token",
    async () =>
      Response.json({
        Pals: {
          Team: {
            instance1: {
              PalID: "Lamball",
              Nickname: "Fluffy",
              Gender: "Female",
              Level: 8,
              Shiny: false,
              PartnerSkillLevel: 2,
              Passives: ["Artisan"],
            },
          },
          Palbox: {},
          BaseCamps: [],
        },
      }),
  );
  const pals = await client.getPals("player-1");
  assert.equal(pals.length, 1);
  assert.deepEqual(pals[0], {
    instanceId: "instance1",
    location: "Team",
    baseCampId: null,
    palId: "Lamball",
    nickname: "Fluffy",
    gender: "Female",
    level: 8,
    experience: null,
    shiny: false,
    rank: 2,
    condensedPals: null,
    physicalHealth: null,
    workerSick: null,
    imported: null,
    hp: null,
    hunger: null,
    maxHunger: null,
    sanity: null,
    support: null,
    craftSpeed: null,
    palSouls: {},
    ivs: {},
    extraWorkSuitabilities: {},
    disabledWorkPreferences: [],
    passiveSkills: ["Artisan"],
    activeSkills: [],
    learnedSkills: [],
  });
});

test("normalizes unlocked technology identifiers", async () => {
  const client = new PalDefenderClient(
    "http://paldefender",
    "token",
    async () =>
      Response.json({
        Techs: { Unlocked: ["Technology_Wood", "Technology_Camp"] },
      }),
  );
  assert.deepEqual(await client.getTechnology("player-1"), [
    "Technology_Wood",
    "Technology_Camp",
  ]);
});

test("kicks a player with the documented reason body and normalizes the response", async () => {
  let requestUrl = "";
  let requestMethod = "";
  let requestBody = "";
  let contentType = "";
  const client = new PalDefenderClient(
    "http://paldefender",
    "token",
    async (input, init) => {
      requestUrl = String(input);
      requestMethod = init?.method ?? "GET";
      requestBody = String(init?.body ?? "");
      contentType = new Headers(init?.headers).get("Content-Type") ?? "";
      return Response.json({ Success: true, UserId: "steam_private" });
    },
  );
  assert.deepEqual(await client.kickPlayer("player-1", "  Maintenance  "), {
    success: true,
    playerId: "player-1",
  });
  assert.equal(requestUrl, "http://paldefender/v1/pdapi/kick/player-1");
  assert.equal(requestMethod, "POST");
  assert.equal(requestBody, JSON.stringify({ Reason: "Maintenance" }));
  assert.equal(contentType, "application/json");
});

test("uses an empty object when no optional kick message is supplied", async () => {
  let requestBody = "";
  const client = new PalDefenderClient(
    "http://paldefender",
    "token",
    async (_input, init) => {
      requestBody = String(init?.body ?? "");
      return Response.json({ Success: true, UserId: "steam_private" });
    },
  );
  await client.kickPlayer("player-1", "   ");
  assert.equal(requestBody, "{}");
});

test("encodes supported player identifiers and rejects path injection", async () => {
  let requested = "";
  const client = new PalDefenderClient(
    "http://paldefender",
    "token",
    async (input) => {
      requested = String(input);
      return Response.json({
        Player: { PlayerUID: "gdk_123", Name: "Player" },
      });
    },
  );
  await client.getPlayer("gdk_123");
  assert.match(requested, /\/player\/gdk_123$/);
  await assert.rejects(
    () => client.getPlayer("../players"),
    /identifier is invalid/i,
  );
});

test("normalizes authentication, not-found, and malformed response errors", async () => {
  const unauthorized = new PalDefenderClient(
    "http://paldefender",
    "token",
    async () =>
      Response.json(
        { Error: { Code: "INVALID_TOKEN", Message: "Bad token" } },
        { status: 401 },
      ),
  );
  await assert.rejects(
    () => unauthorized.getPlayer("player-1"),
    (error: unknown) => error instanceof Error && error.message === "Bad token",
  );
  const malformed = new PalDefenderClient(
    "http://paldefender",
    "token",
    async () => Response.json({ Player: { Name: "missing id" } }),
  );
  await assert.rejects(
    () => malformed.getPlayer("player-1"),
    /malformed response/i,
  );
});

test("normalizes upstream request timeouts", async () => {
  const client = new PalDefenderClient(
    "http://paldefender",
    "token",
    async () => {
      throw new DOMException("Timed out", "TimeoutError");
    },
  );
  await assert.rejects(
    () => client.getPlayer("player-1"),
    (error: unknown) => {
      return (
        error instanceof Error &&
        error.message === "PalDefender request timed out." &&
        "timedOut" in error &&
        error.timedOut === true
      );
    },
  );
});
