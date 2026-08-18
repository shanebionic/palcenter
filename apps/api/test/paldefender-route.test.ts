import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import type { FastifyInstance } from "fastify";
import { SqliteHistoryRepository } from "../src/repositories/sqlite-history-repository.js";

const directory = await fs.mkdtemp(
  path.join(os.tmpdir(), "palcenter-pd-route-"),
);
process.env.NODE_ENV = "test";
process.env.CONFIG_DIR = directory;
process.env.LOG_LEVEL = "silent";
process.env.HISTORY_INTERVAL_SECONDS = "3600";
process.env.PALCENTER_CORS_ORIGINS = "http://localhost:3000";

let app: FastifyInstance;
let administratorCookie = "";
let reloadConfigCalls = 0;
const originalFetch = globalThis.fetch;

function cookie(response: {
  headers: Record<string, string | string[] | undefined>;
}) {
  const value = response.headers["set-cookie"];
  assert.equal(typeof value, "string");
  return value.split(";", 1)[0];
}

before(async () => {
  const now = new Date().toISOString();
  await fs.writeFile(
    path.join(directory, "servers.json"),
    JSON.stringify({
      version: 1,
      servers: [
        {
          id: "server-a",
          name: "Server A",
          baseUrl: "http://palworld-a",
          adminPassword: "admin-password",
          palDefenderEnabled: true,
          palDefenderEndpoint: "http://paldefender",
          palDefenderToken: "route-test-token",
          createdAt: now,
          updatedAt: now,
        },
      ],
    }),
  );
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
    if (url.endsWith("/give/items/player-1")) {
      assert.equal(init?.method, "POST");
      assert.equal(
        init?.body,
        JSON.stringify({
          Items: [
            { ItemID: "CopperIngot", Count: 5 },
            { ItemID: "Polymer", Count: 2 },
          ],
        }),
      );
      return Response.json({ Granted: { Items: 7 } });
    }
    if (url.endsWith("/give/items/invalid-item")) {
      return Response.json(
        {
          Error: {
            Code: "VALIDATION_FAILED",
            Message: "The requested ItemID is unsupported.",
          },
        },
        { status: 400 },
      );
    }
    if (url.endsWith("/give/pals/player-1")) {
      assert.equal(init?.method, "POST");
      assert.equal(
        init?.body,
        JSON.stringify({
          Pals: [
            { PalID: "Anubis", Level: 35 },
            { PalID: "Kitsun", Level: 25 },
          ],
        }),
      );
      return Response.json({ Granted: { Pals: 2 } });
    }
    if (url.endsWith("/give/pals/invalid-pal")) {
      return Response.json(
        {
          Error: {
            Code: "VALIDATION_FAILED",
            Message: "The requested PalID is invalid.",
          },
        },
        { status: 400 },
      );
    }
    if (url.endsWith("/give/paltemplate/player-1")) {
      assert.equal(init?.method, "POST");
      assert.equal(
        init?.body,
        JSON.stringify({ PalTemplates: ["starter.json", "raid-01"] }),
      );
      return Response.json({ Granted: { PalTemplates: 2 } });
    }
    if (url.endsWith("/give/paltemplate/rejected")) {
      return Response.json(
        {
          Error: {
            Code: "VALIDATION_FAILED",
            Message: "The requested Pal template is unavailable.",
          },
        },
        { status: 400 },
      );
    }
    if (url.endsWith("/give/paleggs/player-1")) {
      assert.equal(init?.method, "POST");
      assert.equal(
        init?.body,
        JSON.stringify({
          PalEggs: [
            { EggID: "PalEgg_Fire_01", PalID: "Kitsunebi", Level: 12 },
            { EggID: "PalEgg_Dark_01", PalTemplate: "reward.json" },
          ],
        }),
      );
      return Response.json({ Granted: { PalEggs: 2 } });
    }
    if (url.endsWith("/give/paleggs/rejected")) {
      return Response.json(
        {
          Error: {
            Code: "VALIDATION_FAILED",
            Message: "The requested Pal egg is invalid.",
          },
        },
        { status: 400 },
      );
    }
    if (url.endsWith("/give/progression/player-1")) {
      const body = JSON.parse(String(init?.body));
      return Response.json({ Granted: body, Totals: body });
    }
    if (url.endsWith("/give/progression/stale")) {
      return Response.json(
        {
          Error: {
            Code: "REQUEST_FAILED",
            Message: "Player controller unavailable",
          },
        },
        { status: 400 },
      );
    }
    if (url.endsWith("/learntech/player-1")) {
      assert.equal(init?.method, "POST");
      const technology = JSON.parse(String(init?.body)).Technology;
      return Response.json({
        UnlockedCount: Array.isArray(technology) ? technology.length : 1,
        Unlocked:
          technology === "All" ? ["Technology_Wood"] : [technology].flat(),
        Skipped: [],
      });
    }
    if (url.endsWith("/forgettech/player-1")) {
      assert.equal(init?.method, "POST");
      const technology = JSON.parse(String(init?.body)).Technology;
      return Response.json({
        ForgottenCount: technology === "All" ? 2 : [technology].flat().length,
        Forgotten: technology,
        Skipped: [],
      });
    }
    if (url.endsWith("/learntech/stale"))
      return Response.json(
        {
          Error: {
            Code: "REQUEST_FAILED",
            Message: "Player controller unavailable",
          },
        },
        { status: 400 },
      );
    const moderationActor = {
      Type: "rest",
      NameValue: "route-test",
      IP: "192.0.2.1",
      Reason: "Test record",
      Timestamp: {
        UTC: 1720000000,
        Year: 2024,
        Month: 7,
        Day: 3,
        Hour: 9,
        Min: 46,
        Sec: 40,
        Msec: 0,
      },
    };
    if (url.endsWith("/banlist?active=true"))
      return Response.json({
        Banlist: {
          Version: 1,
          BannedMessage: "You are banned.",
          UserEntries: [
            { UserId: "steam_1", Active: true, BannedBy: moderationActor },
          ],
          IPEntries: [
            { IP: "192.0.2.10", Active: true, BannedBy: moderationActor },
          ],
        },
      });
    if (url.endsWith("/unban/steam_1"))
      return Response.json({ Success: true, UserId: "steam_1" });
    if (url.endsWith("/banip/192.0.2.10"))
      return Response.json({ Success: true, IP: "192.0.2.10", Kicked: 0 });
    if (url.endsWith("/unbanip/192.0.2.10"))
      return Response.json({ Success: true, IP: "192.0.2.10" });
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
    if (url.endsWith("/Alert")) {
      assert.equal(init?.body, JSON.stringify({ Message: "Urgent" }));
      return Response.json({ Success: true });
    }
    if (url.endsWith("/ReloadConfig")) {
      assert.equal(init?.method, "POST");
      assert.equal(init?.body, undefined);
      reloadConfigCalls += 1;
      return Response.json({ Success: true });
    }
    if (url.endsWith("/deletebase/base-1")) {
      assert.equal(init?.method, "POST");
      assert.equal(init?.body, undefined);
      return Response.json({
        BaseCamp: { Id: "base-1", Summary: "Pal Tamers base" },
        Deleted: {
          BaseCampPals: 0,
          StorageContainers: 1,
          ItemStacks: 2,
          ItemCount: 10,
          Buildings: 3,
          DropItems: 0,
          DefenseModels: 0,
          OtherMapObjects: 1,
          PalBox: true,
        },
        Archive: "archive/base-1.zip",
      });
    }
    if (url.endsWith("/deletebase/missing-base")) {
      return Response.json(
        {
          Error: {
            Code: "BASE_CAMP_NOT_FOUND",
            Message: "No base camp matched the supplied GUID.",
          },
        },
        { status: 404 },
      );
    }
    if (url.endsWith("/deletebase/timeout-base")) {
      return Response.json(
        {
          Error: {
            Code: "REQUEST_TIMEOUT",
            Message: "The game-thread callback timed out.",
          },
        },
        { status: 500 },
      );
    }
    if (url.endsWith("/SendPlayerMessage")) {
      assert.equal(
        init?.body,
        JSON.stringify({
          SendType: "PlayerChat",
          UserIDs: ["steam_1", "gdk_2"],
          Message: "Private notice",
        }),
      );
      return Response.json({ Success: true, SentCount: 2 });
    }
    if (url.endsWith("/guild/guild-1")) {
      return Response.json({
        Guild: {
          name: "Pal Tamers",
          Level: 2,
          admin: { id: "player-1", name: "Explorer" },
          member_count: 1,
          members: [
            {
              player_uid: "player-1",
              player_name: "Explorer",
              status: "Online",
            },
          ],
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
          items: { container_id: "container-1", current: 0, max: 54 },
          expeditions: { finished: 0, missions: {} },
          laboratory: { current_research: "None", researches: {} },
        },
      });
    }
    if (url.endsWith("/guild/missing")) {
      return Response.json(
        { Error: { Code: "GUILD_NOT_FOUND", Message: "Missing guild" } },
        { status: 404 },
      );
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
    if (url.includes("/pals/") && (init?.method ?? "GET") === "GET")
      return Response.json({ Pals: { Team: {}, Palbox: {}, BaseCamps: [] } });
    if (url.includes("/techs/"))
      return Response.json({ Techs: { Unlocked: ["Technology_Wood"] } });
    if (url.includes("/progression/") && (init?.method ?? "GET") === "GET")
      return Response.json({
        Meta: { PlayerUID: "player-1", Player: "player-1" },
        Progression: {
          Player: { level: 6, exp: 1371, unusedStatusPoints: 5 },
          Currencies: {
            relics: {},
            technologyPoints: 5,
            ancientTechnologyPoints: 0,
          },
          Bosses: {
            towerBossDefeatCounts: {},
            normalBossDefeatFlags: {},
            raidBossDefeatCounts: {},
            totalBossDefeatCount: 0,
            predatorDefeatCount: 0,
          },
          Captures: {
            tribeCaptureCount: 9,
            palCaptureCounts: { Anubis: 1 },
            palCaptureBonusCounts: { Anubis: 1 },
            palButcherCounts: {},
          },
          Activities: {
            craftItemCounts: { Wood: 3 },
            normalDungeonClearCount: 0,
            fixedDungeonClearCount: 0,
            oilrigClearCount: 0,
            palRankUpCounts: {},
            arenaSoloClearCounts: {},
            npcTalkCounts: {},
            fishingCounts: {},
            foundTreasureCount: 0,
            campConqueredCount: 0,
            firstFishingComplete: false,
          },
        },
      });
    if (url.endsWith("/players"))
      return Response.json({
        Players: [
          {
            Name: "Player",
            PlayerUID: "player-1",
            Status: "Online",
          },
        ],
      });
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
    url: "/api/servers/server-a/paldefender/players/player-1",
  });
  assert.equal(response.statusCode, 401);
  const kick = await app.inject({
    method: "POST",
    url: "/api/servers/server-a/paldefender/players/player-1/kick",
    payload: {},
  });
  assert.equal(kick.statusCode, 401);
  const ban = await app.inject({
    method: "POST",
    url: "/api/servers/server-a/paldefender/players/player-1/ban",
    payload: {},
  });
  assert.equal(ban.statusCode, 401);
  const giveItems = await app.inject({
    method: "POST",
    url: "/api/servers/server-a/paldefender/players/player-1/items",
    payload: { items: [{ itemId: "Wood", count: 1 }] },
  });
  assert.equal(giveItems.statusCode, 401);
  const givePals = await app.inject({
    method: "POST",
    url: "/api/servers/server-a/paldefender/players/player-1/pals",
    payload: { pals: [{ palId: "Anubis", level: 35 }] },
  });
  assert.equal(givePals.statusCode, 401);
  for (const operation of ["learn", "forget"]) {
    const technology = await app.inject({
      method: "POST",
      url: `/api/servers/server-a/paldefender/players/player-1/technology/${operation}`,
      payload: { scope: "selected", technologyIds: ["Technology_Wood"] },
    });
    assert.equal(technology.statusCode, 401);
  }
  const givePalTemplates = await app.inject({
    method: "POST",
    url: "/api/servers/server-a/paldefender/players/player-1/pal-templates",
    payload: { palTemplates: ["starter.json"] },
  });
  assert.equal(givePalTemplates.statusCode, 401);
  const givePalEggs = await app.inject({
    method: "POST",
    url: "/api/servers/server-a/paldefender/players/player-1/pal-eggs",
    payload: {
      palEggs: [
        { mode: "pal-id", eggId: "PalEgg_Fire_01", palId: "Kitsunebi" },
      ],
    },
  });
  assert.equal(givePalEggs.statusCode, 401);
  const broadcast = await app.inject({
    method: "POST",
    url: "/api/servers/server-a/paldefender/broadcast",
    payload: { message: "Hello" },
  });
  assert.equal(broadcast.statusCode, 401);
  const guilds = await app.inject({
    method: "GET",
    url: "/api/servers/server-a/paldefender/guilds",
  });
  assert.equal(guilds.statusCode, 401);
  const bases = await app.inject({
    method: "GET",
    url: "/api/servers/server-a/paldefender/bases",
  });
  assert.equal(bases.statusCode, 401);
  const base = await app.inject({
    method: "GET",
    url: "/api/servers/server-a/paldefender/bases/base-1",
  });
  assert.equal(base.statusCode, 401);
});

test("PalDefender guild route returns PalCenter-owned models", async () => {
  const response = await app.inject({
    method: "GET",
    url: "/api/servers/server-a/paldefender/guilds",
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
    url: "/api/servers/server-a/paldefender/bases",
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

test("PalDefender base details select and normalize a documented guild camp", async () => {
  const headers = { cookie: administratorCookie };
  const response = await app.inject({
    method: "GET",
    url: "/api/servers/server-a/paldefender/bases/base-1",
    headers,
  });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
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

  const missing = await app.inject({
    method: "GET",
    url: "/api/servers/server-a/paldefender/bases/missing",
    headers,
  });
  assert.equal(missing.statusCode, 404);
  assert.equal(missing.json().error, "paldefender_base_not_found");
});

test("PalDefender base deletion routes the exact Base Camp ID and is administrator-only", async () => {
  const administrator = await app.inject({
    method: "POST",
    url: "/api/servers/server-a/paldefender/bases/base-1/delete",
    headers: { cookie: administratorCookie },
    payload: {},
  });
  assert.equal(administrator.statusCode, 200);
  assert.deepEqual(administrator.json(), {
    base: { id: "base-1", summary: "Pal Tamers base" },
    deleted: {
      baseCampPals: 0,
      storageContainers: 1,
      itemStacks: 2,
      itemCount: 10,
      buildings: 3,
      dropItems: 0,
      defenseModels: 0,
      otherMapObjects: 1,
      palBox: true,
    },
    archive: "archive/base-1.zip",
  });

  const unauthenticated = await app.inject({
    method: "POST",
    url: "/api/servers/server-a/paldefender/bases/base-1/delete",
    payload: {},
  });
  assert.equal(unauthenticated.statusCode, 401);

  const missing = await app.inject({
    method: "POST",
    url: "/api/servers/server-a/paldefender/bases/missing-base/delete",
    headers: { cookie: administratorCookie },
    payload: {},
  });
  assert.equal(missing.statusCode, 404);
  assert.equal(missing.json().error, "paldefender_base_not_found");

  const ambiguous = await app.inject({
    method: "POST",
    url: "/api/servers/server-a/paldefender/bases/timeout-base/delete",
    headers: { cookie: administratorCookie },
    payload: {},
  });
  assert.equal(ambiguous.statusCode, 504);
  assert.equal(ambiguous.json().error, "paldefender_timeout");
});

test("PalDefender guild details normalize live data and missing guilds", async () => {
  const headers = { cookie: administratorCookie };
  const response = await app.inject({
    method: "GET",
    url: "/api/servers/server-a/paldefender/guilds/guild-1",
    headers,
  });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    guildId: "guild-1",
    name: "Pal Tamers",
    level: 2,
    administrator: { playerId: "player-1", name: "Explorer" },
    memberCount: 1,
    members: [{ playerId: "player-1", name: "Explorer", status: "Online" }],
    baseCount: 1,
    camps: [
      {
        id: "base-1",
        level: 2,
        state: "Normal",
        worldPosition: { x: 1, y: 2, z: 3 },
        mapPosition: { x: 4, y: 5, z: 6 },
        buildings: "WIP",
        pals: [],
      },
    ],
    storage: {
      containerId: "container-1",
      occupiedSlots: 0,
      maximumSlots: 54,
      items: [],
    },
    expeditions: { finishedCount: 0, missions: {} },
    laboratory: { currentResearch: null, researches: [] },
  });

  const missing = await app.inject({
    method: "GET",
    url: "/api/servers/server-a/paldefender/guilds/missing",
    headers,
  });
  assert.equal(missing.statusCode, 404);
  assert.equal(missing.json().error, "paldefender_guild_not_found");
});

test("PalDefender technology mutations validate and normalize selected and all scopes", async () => {
  const headers = { cookie: administratorCookie };
  const learn = await app.inject({
    method: "POST",
    url: "/api/servers/server-a/paldefender/players/player-1/technology/learn",
    headers,
    payload: {
      scope: "selected",
      technologyIds: ["Technology_Wood", "Technology_Camp"],
    },
  });
  assert.equal(learn.statusCode, 200);
  assert.deepEqual(learn.json(), {
    changedCount: 2,
    changed: ["Technology_Wood", "Technology_Camp"],
    skipped: [],
  });

  const forget = await app.inject({
    method: "POST",
    url: "/api/servers/server-a/paldefender/players/player-1/technology/forget",
    headers,
    payload: { scope: "all" },
  });
  assert.equal(forget.statusCode, 200);
  assert.deepEqual(forget.json(), {
    changedCount: 2,
    changed: "All",
    skipped: [],
  });

  for (const payload of [
    { scope: "selected", technologyIds: [] },
    { scope: "selected", technologyIds: ["Bad ID"] },
    { scope: "selected", technologyIds: ["All"] },
    {
      scope: "selected",
      technologyIds: ["Technology_Wood", "Technology_Wood"],
    },
    { scope: "all", technologyIds: ["Technology_Wood"] },
  ]) {
    const invalid = await app.inject({
      method: "POST",
      url: "/api/servers/server-a/paldefender/players/player-1/technology/learn",
      headers,
      payload,
    });
    assert.equal(invalid.statusCode, 400);
  }

  const stale = await app.inject({
    method: "POST",
    url: "/api/servers/server-a/paldefender/players/stale/technology/learn",
    headers,
    payload: { scope: "selected", technologyIds: ["Technology_Wood"] },
  });
  assert.equal(stale.statusCode, 400);
  assert.equal(stale.json().error, "paldefender_request_failed");
});

test("PalDefender kick route normalizes success and offline errors", async () => {
  const headers = { cookie: administratorCookie };
  const kicked = await app.inject({
    method: "POST",
    url: "/api/servers/server-a/paldefender/players/player-1/kick",
    headers,
    payload: { message: "Please reconnect" },
  });
  assert.equal(kicked.statusCode, 200);
  assert.deepEqual(kicked.json(), { success: true, playerId: "player-1" });

  const offline = await app.inject({
    method: "POST",
    url: "/api/servers/server-a/paldefender/players/offline/kick",
    headers,
    payload: {},
  });
  assert.equal(offline.statusCode, 404);
  assert.deepEqual(offline.json(), {
    error: "paldefender_player_offline",
    message: "This player is no longer online and cannot be kicked.",
  });
});

test("PalDefender give items route validates input and normalizes responses", async () => {
  const headers = { cookie: administratorCookie };
  const granted = await app.inject({
    method: "POST",
    url: "/api/servers/server-a/paldefender/players/player-1/items",
    headers,
    payload: {
      items: [
        { itemId: "CopperIngot", count: 5 },
        { itemId: "Polymer", count: 2 },
      ],
    },
  });
  assert.equal(granted.statusCode, 200);
  assert.deepEqual(granted.json(), { playerId: "player-1", grantedItems: 7 });

  for (const payload of [
    { items: [] },
    { items: [{ itemId: "", count: 1 }] },
    { items: [{ itemId: "Bad ID", count: 1 }] },
    { items: [{ itemId: "Wood", count: 0 }] },
    { items: [{ itemId: "Wood", count: 1.5 }] },
  ]) {
    const invalid = await app.inject({
      method: "POST",
      url: "/api/servers/server-a/paldefender/players/player-1/items",
      headers,
      payload,
    });
    assert.equal(invalid.statusCode, 400);
  }

  const rejected = await app.inject({
    method: "POST",
    url: "/api/servers/server-a/paldefender/players/invalid-item/items",
    headers,
    payload: { items: [{ itemId: "DefinitelyNotAnItem", count: 1 }] },
  });
  assert.equal(rejected.statusCode, 400);
  assert.deepEqual(rejected.json(), {
    error: "paldefender_request_failed",
    message: "The requested ItemID is unsupported.",
  });
});

test("PalDefender give Pals route validates input and normalizes responses", async () => {
  const headers = { cookie: administratorCookie };
  const granted = await app.inject({
    method: "POST",
    url: "/api/servers/server-a/paldefender/players/player-1/pals",
    headers,
    payload: {
      pals: [
        { palId: "Anubis", level: 35 },
        { palId: "Kitsun", level: 25 },
      ],
    },
  });
  assert.equal(granted.statusCode, 200);
  assert.deepEqual(granted.json(), { playerId: "player-1", grantedPals: 2 });

  for (const payload of [
    {},
    { pals: [] },
    { pals: [{ palId: "", level: 1 }] },
    { pals: [{ palId: "Bad ID", level: 1 }] },
    { pals: [{ palId: "Anubis", level: 0 }] },
    { pals: [{ palId: "Anubis", level: 1.5 }] },
  ]) {
    const invalid = await app.inject({
      method: "POST",
      url: "/api/servers/server-a/paldefender/players/player-1/pals",
      headers,
      payload,
    });
    assert.equal(invalid.statusCode, 400);
  }

  const rejected = await app.inject({
    method: "POST",
    url: "/api/servers/server-a/paldefender/players/invalid-pal/pals",
    headers,
    payload: { pals: [{ palId: "DefinitelyNotAPal", level: 1 }] },
  });
  assert.equal(rejected.statusCode, 400);
  assert.deepEqual(rejected.json(), {
    error: "paldefender_request_failed",
    message: "The requested PalID is invalid.",
  });
});

test("PalDefender Pal provisioning routes validate and normalize both contracts", async () => {
  const headers = { cookie: administratorCookie };
  const templates = await app.inject({
    method: "POST",
    url: "/api/servers/server-a/paldefender/players/player-1/pal-templates",
    headers,
    payload: { palTemplates: ["starter.json", "raid-01"] },
  });
  assert.equal(templates.statusCode, 200);
  assert.deepEqual(templates.json(), {
    playerId: "player-1",
    grantedPalTemplates: 2,
  });

  for (const payload of [
    {},
    { palTemplates: [] },
    { palTemplates: ["../unsafe.json"] },
    { palTemplates: ["folder/template.json"] },
  ]) {
    const invalid = await app.inject({
      method: "POST",
      url: "/api/servers/server-a/paldefender/players/player-1/pal-templates",
      headers,
      payload,
    });
    assert.equal(invalid.statusCode, 400);
  }

  const eggs = await app.inject({
    method: "POST",
    url: "/api/servers/server-a/paldefender/players/player-1/pal-eggs",
    headers,
    payload: {
      palEggs: [
        {
          mode: "pal-id",
          eggId: "PalEgg_Fire_01",
          palId: "Kitsunebi",
          level: 12,
        },
        {
          mode: "template",
          eggId: "PalEgg_Dark_01",
          palTemplate: "reward.json",
        },
      ],
    },
  });
  assert.equal(eggs.statusCode, 200);
  assert.deepEqual(eggs.json(), { playerId: "player-1", grantedPalEggs: 2 });

  for (const payload of [
    {},
    { palEggs: [] },
    { palEggs: [{ mode: "pal-id", eggId: "bad id", palId: "Kitsunebi" }] },
    { palEggs: [{ mode: "pal-id", eggId: "PalEgg_Fire_01" }] },
    {
      palEggs: [
        {
          mode: "pal-id",
          eggId: "PalEgg_Fire_01",
          palId: "Kitsunebi",
          palTemplate: "also.json",
        },
      ],
    },
    {
      palEggs: [
        {
          mode: "template",
          eggId: "PalEgg_Dark_01",
          palTemplate: "../unsafe.json",
        },
      ],
    },
  ]) {
    const invalid = await app.inject({
      method: "POST",
      url: "/api/servers/server-a/paldefender/players/player-1/pal-eggs",
      headers,
      payload,
    });
    assert.equal(invalid.statusCode, 400);
  }

  const rejected = await app.inject({
    method: "POST",
    url: "/api/servers/server-a/paldefender/players/rejected/pal-eggs",
    headers,
    payload: {
      palEggs: [
        { mode: "pal-id", eggId: "PalEgg_Fire_01", palId: "Kitsunebi" },
      ],
    },
  });
  assert.equal(rejected.statusCode, 400);
  assert.deepEqual(rejected.json(), {
    error: "paldefender_request_failed",
    message: "The requested Pal egg is invalid.",
  });
});

test("PalDefender broadcast validates and normalizes messages and failures", async () => {
  const headers = { cookie: administratorCookie };
  const sent = await app.inject({
    method: "POST",
    url: "/api/servers/server-a/paldefender/broadcast",
    headers,
    payload: { message: "Hello, Palpagos! ⚡" },
  });
  assert.equal(sent.statusCode, 200);
  assert.deepEqual(sent.json(), { success: true });

  for (const message of ["", "   \n\t"]) {
    const invalid = await app.inject({
      method: "POST",
      url: "/api/servers/server-a/paldefender/broadcast",
      headers,
      payload: { message },
    });
    assert.equal(invalid.statusCode, 400);
  }

  const failed = await app.inject({
    method: "POST",
    url: "/api/servers/server-a/paldefender/broadcast",
    headers,
    payload: { message: "fail" },
  });
  assert.equal(failed.statusCode, 400);
  assert.deepEqual(failed.json(), {
    error: "paldefender_request_failed",
    message: "Broadcast failed",
  });
});

test("PalDefender alert and player message routes validate and normalize requests", async () => {
  const headers = { cookie: administratorCookie };
  const alert = await app.inject({
    method: "POST",
    url: "/api/servers/server-a/paldefender/alert",
    headers,
    payload: { message: "Urgent" },
  });
  assert.deepEqual(alert.json(), { success: true });

  const playerMessage = await app.inject({
    method: "POST",
    url: "/api/servers/server-a/paldefender/player-message",
    headers,
    payload: {
      playerIds: ["steam_1", "gdk_2", "steam_1"],
      sendType: "PlayerChat",
      message: "Private notice",
    },
  });
  assert.deepEqual(playerMessage.json(), { success: true, sentCount: 2 });

  for (const payload of [
    { message: "" },
    { playerIds: [], sendType: "PlayerChat", message: "Hello" },
    { playerIds: ["steam_1"], sendType: "Unknown", message: "Hello" },
  ]) {
    const url = "playerIds" in payload ? "player-message" : "alert";
    const response = await app.inject({
      method: "POST",
      url: `/api/servers/server-a/paldefender/${url}`,
      headers,
      payload,
    });
    assert.equal(response.statusCode, 400);
  }
});

test("PalDefender configuration reload is administrator-only and normalized", async () => {
  const administrator = await app.inject({
    method: "POST",
    url: "/api/servers/server-a/paldefender/reload-config",
    headers: { cookie: administratorCookie },
    payload: {},
  });
  assert.equal(administrator.statusCode, 200);
  assert.deepEqual(administrator.json(), { success: true });

  const unauthenticated = await app.inject({
    method: "POST",
    url: "/api/servers/server-a/paldefender/reload-config",
    payload: {},
  });
  assert.equal(unauthenticated.statusCode, 401);
});

test("PalDefender reload-config treats {} and a bodyless request the same", async () => {
  const reader = new SqliteHistoryRepository(directory);
  const listReloadEntries = () =>
    reader
      .listAudit("server-a", {
        category: "server",
        result: "success",
        limit: 200,
      })
      .filter((entry) => entry.action === "reload_paldefender");
  const nextId = listReloadEntries().reduce(
    (max, entry) => Math.max(max, entry.id),
    0,
  );

  const expectOneUpstreamCall = (
    label: string,
    response: { statusCode: number; json(): unknown },
  ) => {
    assert.equal(
      response.statusCode,
      200,
      `${label}: expected 200, got ${response.statusCode}`,
    );
    assert.deepEqual(response.json(), { success: true }, `${label}: body`);
    assert.equal(
      reloadConfigCalls,
      1,
      `${label}: upstream reload invoked exactly once`,
    );
  };

  // (a) An authorized {} body still succeeds and invokes the upstream action once.
  reloadConfigCalls = 0;
  const object = await app.inject({
    method: "POST",
    url: "/api/servers/server-a/paldefender/reload-config",
    headers: { cookie: administratorCookie },
    payload: {},
  });
  expectOneUpstreamCall("body {}", object);

  // (b) A bodyless request (empty application/json payload) succeeds the same way.
  reloadConfigCalls = 0;
  const empty = await app.inject({
    method: "POST",
    url: "/api/servers/server-a/paldefender/reload-config",
    headers: {
      cookie: administratorCookie,
      "content-type": "application/json",
    },
    payload: "",
  });
  expectOneUpstreamCall("bodyless application/json", empty);

  // (h) Both successful reloads record a `reload_paldefender` audit entry
  // (server + actor) with the server-default credential source.
  const recorded = listReloadEntries().filter((entry) => entry.id > nextId);
  assert.equal(
    recorded.length,
    2,
    "both the {} and bodyless reloads recorded an audit entry",
  );
  for (const entry of recorded) {
    assert.equal(entry.result, "success");
    assert.equal(entry.actorUsername, "administrator");
    assert.equal(entry.details.palDefenderCredentialSource, "server_default");
  }
  reader.close();

  // (c) An empty request without a content type still succeeds (pre-existing path).
  reloadConfigCalls = 0;
  const noContentType = await app.inject({
    method: "POST",
    url: "/api/servers/server-a/paldefender/reload-config",
    headers: { cookie: administratorCookie },
  });
  expectOneUpstreamCall("bodyless without content type", noContentType);
});

test("PalDefender reload-config rejections keep sibling parsing and skip upstream", async () => {
  // (e) A malformed non-empty JSON body is rejected and the upstream action is NOT invoked.
  reloadConfigCalls = 0;
  const malformed = await app.inject({
    method: "POST",
    url: "/api/servers/server-a/paldefender/reload-config",
    headers: {
      cookie: administratorCookie,
      "content-type": "application/json",
    },
    payload: "{ not valid json",
  });
  assert.equal(malformed.statusCode, 400);
  assert.equal(reloadConfigCalls, 0);

  // (f) An unrelated action route with an empty application/json body is still
  // rejected, proving the empty-tolerant parser is scoped to reload-config only.
  const sibling = await app.inject({
    method: "POST",
    url: "/api/servers/server-a/paldefender/player-message",
    headers: {
      cookie: administratorCookie,
      "content-type": "application/json",
    },
    payload: "",
  });
  assert.equal(sibling.statusCode, 400);

  // (d) Authorization is preserved: an unauthenticated bodyless reload is rejected.
  const unauthenticated = await app.inject({
    method: "POST",
    url: "/api/servers/server-a/paldefender/reload-config",
    headers: { "content-type": "application/json" },
    payload: "",
  });
  assert.equal(unauthenticated.statusCode, 401);
});

test("PalDefender reload-config rejects prototype/constructor poisoning JSON without invoking upstream", async () => {
  // (e') Prototype- and constructor-poisoning payloads are non-empty application/json
  // bodies. The delegated secure parser (protoAction/constructorAction 'error') throws
  // and maps them to a 400 before the handler runs, so the administrative upstream
  // reload action is never invoked for either payload.
  reloadConfigCalls = 0;
  const protoPoison = await app.inject({
    method: "POST",
    url: "/api/servers/server-a/paldefender/reload-config",
    headers: {
      cookie: administratorCookie,
      "content-type": "application/json",
    },
    payload: '{"__proto__": {"isAdmin": true}}',
  });
  assert.equal(protoPoison.statusCode, 400);
  assert.equal(reloadConfigCalls, 0);

  reloadConfigCalls = 0;
  const constructorPoison = await app.inject({
    method: "POST",
    url: "/api/servers/server-a/paldefender/reload-config",
    headers: {
      cookie: administratorCookie,
      "content-type": "application/json",
    },
    payload: '{"constructor": {"prototype": {"isAdmin": true}}}',
  });
  assert.equal(constructorPoison.statusCode, 400);
  assert.equal(reloadConfigCalls, 0);
});

test("PalDefender reload-config keeps the normalized upstream-failure response", async () => {
  // (g) An upstream failure still surfaces through the root error handler's
  // normalized PalDefender error shape (not Fastify's default handler).
  const originalFetchLocal = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("connect ECONNREFUSED");
  };
  try {
    const failed = await app.inject({
      method: "POST",
      url: "/api/servers/server-a/paldefender/reload-config",
      headers: {
        cookie: administratorCookie,
        "content-type": "application/json",
      },
      payload: "",
    });
    assert.equal(failed.statusCode, 502);
    assert.ok(
      ["paldefender_unavailable", "paldefender_endpoint_unavailable"].includes(
        failed.json().error,
      ),
      `Expected a normalized PalDefender error code, got: ${failed.json().error}`,
    );
  } finally {
    globalThis.fetch = originalFetchLocal;
  }
});

test("PalDefender ban route normalizes success and unavailable IP errors", async () => {
  const headers = { cookie: administratorCookie };
  const banned = await app.inject({
    method: "POST",
    url: "/api/servers/server-a/paldefender/players/player-1/ban",
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
    url: "/api/servers/server-a/paldefender/players/no-ip/ban",
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
    url: "/api/servers/server-a/paldefender/players/rejected/ban",
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
    url: "/api/servers/server-a/paldefender/players/player-1",
    headers,
  });
  assert.equal(detail.statusCode, 200);
  assert.deepEqual(detail.json(), {
    name: "Player",
    playerId: "player-1",
    userId: "",
    online: true,
    guild: null,
    level: null,
    worldLocation: null,
    mapLocation: null,
  });
  const inventory = await app.inject({
    method: "GET",
    url: "/api/servers/server-a/paldefender/players/player-1/inventory",
    headers,
  });
  assert.deepEqual(inventory.json().items, [
    { container: "Items", slot: 0, itemId: "Wood", quantity: 3 },
  ]);
  const pals = await app.inject({
    method: "GET",
    url: "/api/servers/server-a/paldefender/players/player-1/pals",
    headers,
  });
  assert.deepEqual(pals.json(), { pals: [] });
  const technology = await app.inject({
    method: "GET",
    url: "/api/servers/server-a/paldefender/players/player-1/technology",
    headers,
  });
  assert.deepEqual(technology.json(), { technologies: ["Technology_Wood"] });
  const progression = await app.inject({
    method: "GET",
    url: "/api/servers/server-a/paldefender/players/player-1/progression",
    headers,
  });
  assert.equal(progression.statusCode, 200);
  assert.equal(progression.json().character.level, 6);
  assert.deepEqual(progression.json().captures.byPal, { Anubis: 1 });
  assert.deepEqual(progression.json().activities.craftedItems, { Wood: 3 });
});

test("Give Progression validates every documented grant and normalizes failures", async () => {
  const headers = { cookie: administratorCookie };
  const grants = [
    { type: "experience", amount: 10 },
    { type: "technologyPoints", amount: 2 },
    { type: "ancientTechnologyPoints", amount: 1 },
    { type: "relic", relicType: "CapturePower", amount: 1 },
  ];
  for (const grant of grants) {
    const response = await app.inject({
      method: "POST",
      url: "/api/servers/server-a/paldefender/players/player-1/progression",
      headers,
      payload: grant,
    });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json().grant, grant);
  }
  for (const payload of [
    {},
    { type: "unsupported", amount: 1 },
    { type: "experience" },
    { type: "experience", amount: 0 },
    { type: "experience", amount: -1 },
    { type: "experience", amount: 1.5 },
    { type: "relic", relicType: "Unknown", amount: 1 },
  ]) {
    const response = await app.inject({
      method: "POST",
      url: "/api/servers/server-a/paldefender/players/player-1/progression",
      headers,
      payload,
    });
    assert.equal(response.statusCode, 400);
  }
  const stale = await app.inject({
    method: "POST",
    url: "/api/servers/server-a/paldefender/players/stale/progression",
    headers,
    payload: { type: "experience", amount: 1 },
  });
  assert.equal(stale.statusCode, 400);
  assert.deepEqual(stale.json(), {
    error: "paldefender_request_failed",
    message: "Player controller unavailable",
  });
});

test("moderation routes normalize the banlist and validate reversible mutations", async () => {
  const headers = { cookie: administratorCookie };
  const list = await app.inject({
    method: "GET",
    url: "/api/servers/server-a/moderation",
    headers,
  });
  assert.equal(list.statusCode, 200);
  assert.equal(list.json().userBans[0].userId, "steam_1");
  assert.equal(list.json().ipBans[0].ip, "192.0.2.10");
  for (const [url, payload, target] of [
    [
      "/api/servers/server-a/moderation/users/steam_1/unban",
      { reason: "Appeal accepted" },
      "steam_1",
    ],
    [
      "/api/servers/server-a/moderation/ip/ban",
      { ip: "192.0.2.10", reason: "Controlled test" },
      "192.0.2.10",
    ],
    [
      "/api/servers/server-a/moderation/ip/unban",
      { ip: "192.0.2.10" },
      "192.0.2.10",
    ],
  ] as const) {
    const response = await app.inject({
      method: "POST",
      url,
      headers,
      payload,
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().target, target);
  }
  const invalidIp = await app.inject({
    method: "POST",
    url: "/api/servers/server-a/moderation/ip/ban",
    headers,
    payload: { ip: "not-an-ip" },
  });
  assert.equal(invalidIp.statusCode, 400);
  const invalidUser = await app.inject({
    method: "POST",
    url: "/api/servers/server-a/moderation/users/..%2Fplayers/unban",
    headers,
    payload: {},
  });
  assert.equal(invalidUser.statusCode, 400);
});

test("PalDefender not-found and invalid player identifiers are normalized", async () => {
  const headers = { cookie: administratorCookie };
  const missing = await app.inject({
    method: "GET",
    url: "/api/servers/server-a/paldefender/players/missing",
    headers,
  });
  assert.equal(missing.statusCode, 404);
  assert.equal(missing.json().error, "paldefender_player_not_found");
  const invalid = await app.inject({
    method: "GET",
    url: "/api/servers/server-a/paldefender/players/bad%2Fid",
    headers,
  });
  assert.equal(invalid.statusCode, 400);
});

test("PalDefender responses include CORS and security headers", async () => {
  const response = await app.inject({
    method: "GET",
    url: "/api/servers/server-a/paldefender/players/player-1",
    headers: {
      cookie: administratorCookie,
      origin: "http://localhost:3000",
    },
  });
  assert.equal(response.statusCode, 200);
  assert.ok(
    response.headers["access-control-allow-credentials"] === "true",
    "CORS credentials header should be present",
  );
  assert.ok(
    response.headers["cache-control"] === "no-store",
    "Cache-Control header should be set",
  );
  assert.ok(
    response.headers["x-content-type-options"] === "nosniff",
    "X-Content-Type-Options header should be set",
  );
});

test("PalDefender CORS origin check rejects state-changing cross-origin requests", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/servers/server-a/paldefender/players/player-1/kick",
    headers: {
      cookie: administratorCookie,
      origin: "http://evil.example",
      host: "localhost:3001",
    },
    payload: { message: "Please reconnect" },
  });
  assert.equal(response.statusCode, 403);
  assert.equal(response.json().error, "origin_not_allowed");
});

test("PalDefender CORS allows same-origin state-changing requests", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/servers/server-a/paldefender/players/player-1/kick",
    headers: {
      cookie: administratorCookie,
      origin: "http://localhost:3001",
      host: "localhost:3001",
    },
    payload: { message: "Please reconnect" },
  });
  assert.equal(response.statusCode, 200);
});

test("PalDefender mutation routes enforce role-based authorization", async () => {
  const createRoleUser = async (
    username: string,
    role: "moderator" | "visitor",
  ) => {
    const initialPassword = `${username}-Password-123!`;
    const replacementPassword = `${username}-Replacement-456!`;
    const created = await app.inject({
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
    assert.equal(created.statusCode, 201);
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username, password: initialPassword },
    });
    assert.equal(login.statusCode, 200);
    const tempCookie = cookie(login);
    const change = await app.inject({
      method: "POST",
      url: "/api/users/me/password",
      headers: { cookie: tempCookie },
      payload: {
        currentPassword: initialPassword,
        newPassword: replacementPassword,
        passwordConfirmation: replacementPassword,
      },
    });
    assert.equal(change.statusCode, 200);
    const relogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username, password: replacementPassword },
    });
    assert.equal(relogin.statusCode, 200);
    return cookie(relogin);
  };

  const moderatorCookie = await createRoleUser("mod-pd-test-role", "moderator");
  const visitorCookie = await createRoleUser("visitor-pd-test-role", "visitor");

  // Moderator CANNOT execute "manage_servers" mutations (base delete)
  const modBaseDelete = await app.inject({
    method: "POST",
    url: "/api/servers/server-a/paldefender/bases/base-1/delete",
    headers: { cookie: moderatorCookie },
    payload: {},
  });
  assert.equal(modBaseDelete.statusCode, 403);
  assert.equal(modBaseDelete.json().error, "insufficient_permissions");

  // Moderator CANNOT execute "manage_servers" mutations (reload-config)
  const modReload = await app.inject({
    method: "POST",
    url: "/api/servers/server-a/paldefender/reload-config",
    headers: { cookie: moderatorCookie },
    payload: {},
  });
  assert.equal(modReload.statusCode, 403);
  assert.equal(modReload.json().error, "insufficient_permissions");

  // Visitor CANNOT execute any mutation (including "operate" routes)
  const visitorKick = await app.inject({
    method: "POST",
    url: "/api/servers/server-a/paldefender/players/player-1/kick",
    headers: { cookie: visitorCookie },
    payload: { message: "Please reconnect" },
  });
  assert.equal(visitorKick.statusCode, 403);
  assert.equal(visitorKick.json().error, "insufficient_permissions");

  // Visitor CAN read PalDefender data
  const visitorRead = await app.inject({
    method: "GET",
    url: "/api/servers/server-a/paldefender/players",
    headers: { cookie: visitorCookie },
  });
  assert.equal(visitorRead.statusCode, 200);
});

test("PalDefender network failure maps to 502 on mutation routes", async () => {
  const originalFetchLocal = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("connect ECONNREFUSED");
  };

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/servers/server-a/paldefender/players/player-1/kick",
      headers: { cookie: administratorCookie },
      payload: { message: "Please reconnect" },
    });
    assert.equal(response.statusCode, 502);
    assert.ok(
      ["paldefender_unavailable", "paldefender_endpoint_unavailable"].includes(
        response.json().error,
      ),
      `Expected paldefender error code, got: ${response.json().error}`,
    );
  } finally {
    globalThis.fetch = originalFetchLocal;
  }
});
