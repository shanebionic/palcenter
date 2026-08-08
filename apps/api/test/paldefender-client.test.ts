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

test("normalizes documented PalDefender guild summaries", async () => {
  const client = new PalDefenderClient(
    "http://paldefender",
    "token",
    async () =>
      Response.json({
        Meta: { GuildCount: 1 },
        Guilds: {
          "guild-1": {
            name: "Pal Tamers",
            Level: 3,
            admin: { id: "player-1", name: "Explorer" },
            camp_count: 1,
            camps: [
              {
                id: "camp-1",
                world_pos: { x: 1, y: 2, z: 3 },
                map_pos: { x: 4, y: 5, z: 6 },
              },
            ],
            member_count: 2,
            members: ["player-1", "player-2"],
          },
        },
      }),
  );

  assert.deepEqual(await client.getGuilds(), [
    {
      guildId: "guild-1",
      name: "Pal Tamers",
      level: 3,
      administrator: { playerId: "player-1", name: "Explorer" },
      baseCount: 1,
      camps: [
        {
          id: "camp-1",
          worldPosition: { x: 1, y: 2, z: 3 },
          mapPosition: { x: 4, y: 5, z: 6 },
        },
      ],
      memberCount: 2,
      memberIds: ["player-1", "player-2"],
    },
  ]);
});

test("derives normalized bases from documented guild summaries", async () => {
  const client = new PalDefenderClient(
    "http://paldefender",
    "token",
    async () =>
      Response.json({
        Guilds: {
          "guild-1": {
            name: "Pal Tamers",
            Level: 3,
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
      }),
  );
  assert.deepEqual(await client.getBases(), [
    {
      baseId: "base-1",
      guildId: "guild-1",
      guildName: "Pal Tamers",
      guildAdministrator: { playerId: "player-1", name: "Explorer" },
      worldPosition: { x: 1, y: 2, z: 3 },
      mapPosition: { x: 4, y: 5, z: 6 },
    },
  ]);
});

test("loads one normalized base through documented guild endpoints", async () => {
  const client = new PalDefenderClient(
    "http://paldefender",
    "token",
    async (input) => {
      if (String(input).endsWith("/guilds")) {
        return Response.json({
          Guilds: {
            "guild-1": {
              name: "Pal Tamers",
              Level: 3,
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
      return Response.json({
        Guild: {
          name: "Pal Tamers",
          Level: 3,
          admin: { id: "player-1", name: "Explorer" },
          member_count: 1,
          members: [],
          camp_count: 1,
          camps: [
            {
              id: "base-1",
              level: 2,
              world_pos: { x: 1, y: 2, z: 3 },
              map_pos: { x: 4, y: 5, z: 6 },
              state: "Normal",
              pals: {},
              buildings: "WIP",
            },
          ],
          items: { current: 0, max: 0 },
          expeditions: { finished: 0, missions: {} },
          laboratory: { current_research: "None", researches: {} },
        },
      });
    },
  );

  assert.deepEqual(await client.getBase("base-1"), {
    baseId: "base-1",
    guildId: "guild-1",
    guildName: "Pal Tamers",
    guildAdministrator: { playerId: "player-1", name: "Explorer" },
    worldPosition: { x: 1, y: 2, z: 3 },
    mapPosition: { x: 4, y: 5, z: 6 },
    level: 2,
    state: "Normal",
    buildings: null,
    pals: [],
  });
  await assert.rejects(
    () => client.getBase("missing"),
    (error: unknown) =>
      error instanceof Error && error.message === "Base not found",
  );
});

test("normalizes documented PalDefender guild details", async () => {
  const client = new PalDefenderClient(
    "http://paldefender",
    "token",
    async () =>
      Response.json({
        Guild: {
          name: "Pal Tamers",
          Level: 3,
          admin: { id: "player-1", name: "Explorer" },
          member_count: 1,
          members: [
            {
              player_uid: "player-1",
              player_name: "Explorer",
              status: "Online",
            },
          ],
          camp_count: 0,
          camps: [],
          items: {
            container_id: "container-1",
            current: 1,
            max: 54,
            "0": { item_id: "Wood", count: 10 },
            "1": {},
          },
          expeditions: { finished: 2, missions: { DUNGEON_GRASS: true } },
          laboratory: {
            current_research: "None",
            researches: {},
          },
        },
      }),
  );

  assert.deepEqual(await client.getGuild("guild-1"), {
    guildId: "guild-1",
    name: "Pal Tamers",
    level: 3,
    administrator: { playerId: "player-1", name: "Explorer" },
    memberCount: 1,
    members: [{ playerId: "player-1", name: "Explorer", status: "Online" }],
    baseCount: 0,
    camps: [],
    storage: {
      containerId: "container-1",
      occupiedSlots: 1,
      maximumSlots: 54,
      items: [{ slot: 0, itemId: "Wood", quantity: 10 }],
    },
    expeditions: { finishedCount: 2, missions: { DUNGEON_GRASS: true } },
    laboratory: { currentResearch: null, researches: [] },
  });
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

test("gives multiple items using the documented endpoint and normalizes the result", async () => {
  let requestUrl = "";
  let requestMethod = "";
  let requestBody = "";
  let authorization = "";
  const client = new PalDefenderClient(
    "http://paldefender",
    "token",
    async (input, init) => {
      requestUrl = String(input);
      requestMethod = init?.method ?? "GET";
      requestBody = String(init?.body ?? "");
      authorization = new Headers(init?.headers).get("Authorization") ?? "";
      return Response.json({ Granted: { Items: 7 } });
    },
  );
  assert.deepEqual(
    await client.giveItems("player-1", [
      { itemId: "CopperIngot", count: 5 },
      { itemId: "Polymer", count: 2 },
    ]),
    { playerId: "player-1", grantedItems: 7 },
  );
  assert.equal(requestUrl, "http://paldefender/v1/pdapi/give/items/player-1");
  assert.equal(requestMethod, "POST");
  assert.equal(authorization, "Bearer token");
  assert.equal(
    requestBody,
    JSON.stringify({
      Items: [
        { ItemID: "CopperIngot", Count: 5 },
        { ItemID: "Polymer", Count: 2 },
      ],
    }),
  );
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

test("bans a player with every documented option and normalizes the response", async () => {
  let requestUrl = "";
  let requestBody = "";
  const client = new PalDefenderClient(
    "http://paldefender",
    "token",
    async (input, init) => {
      requestUrl = String(input);
      requestBody = String(init?.body ?? "");
      return Response.json({
        Success: true,
        UserId: "steam_private",
        IP: true,
        BannedIP: "192.0.2.1",
        Kicked: 1,
      });
    },
  );
  assert.deepEqual(
    await client.banPlayer("player-1", {
      reason: "  Repeated abuse  ",
      ipBan: true,
    }),
    {
      success: true,
      playerId: "player-1",
      ipBanned: true,
      bannedIp: "192.0.2.1",
      kickedPlayers: 1,
    },
  );
  assert.equal(requestUrl, "http://paldefender/v1/pdapi/ban/player-1");
  assert.equal(
    requestBody,
    JSON.stringify({ Reason: "Repeated abuse", IP: true }),
  );
});

test("omits undocumented and disabled ban options", async () => {
  let requestBody = "";
  const client = new PalDefenderClient(
    "http://paldefender",
    "token",
    async (_input, init) => {
      requestBody = String(init?.body ?? "");
      return Response.json({
        Success: true,
        UserId: "steam_private",
        IP: false,
        BannedIP: "",
        Kicked: 0,
      });
    },
  );
  const result = await client.banPlayer("player-1", {
    reason: "   ",
    ipBan: false,
  });
  assert.equal(requestBody, "{}");
  assert.equal(result.bannedIp, null);
});

test("broadcasts documented messages without changing Unicode or formatting", async () => {
  let requestUrl = "";
  let requestBody = "";
  const client = new PalDefenderClient(
    "http://paldefender",
    "token",
    async (input, init) => {
      requestUrl = String(input);
      requestBody = String(init?.body ?? "");
      return Response.json({ Success: true });
    },
  );
  const message = "Server restart soon.\n戻ってください — ⚡";
  assert.deepEqual(await client.broadcast(message), { success: true });
  assert.equal(requestUrl, "http://paldefender/v1/pdapi/Broadcast");
  assert.equal(requestBody, JSON.stringify({ Message: message }));
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
