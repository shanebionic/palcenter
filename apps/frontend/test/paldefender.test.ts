import assert from "node:assert/strict";
import test from "node:test";
import {
  palDefenderBaseHref,
  palDefenderGuildHref,
  palDefenderPlayerHref,
} from "../lib/paldefender";
import {
  broadcastCharacterCount,
  broadcastValidationError,
} from "../lib/paldefender-broadcast";
import {
  banPalDefenderPlayer,
  broadcastPalDefenderMessage,
  getPalDefenderBase,
  getPalDefenderBases,
  getPalDefenderGuilds,
  getPalDefenderGuild,
  getPalDefenderProgression,
  givePalDefenderItems,
  givePalDefenderPalEggs,
  givePalDefenderPalTemplates,
  givePalDefenderPals,
  givePalDefenderProgression,
  kickPalDefenderPlayer,
  getModerationState,
  banModerationIp,
  unbanModerationIp,
  unbanModerationUser,
  learnPalDefenderTechnology,
  forgetPalDefenderTechnology,
} from "../lib/api";
import {
  normalizeItemGrants,
  validateItemGrants,
} from "../lib/paldefender-items";
import {
  normalizePalEggGrant,
  normalizePalGrant,
  validatePalEggGrant,
  validatePalGrant,
  validatePalTemplateGrant,
} from "../lib/paldefender-pals";

test("builds and loads an encoded PalDefender base details route", async () => {
  assert.equal(
    palDefenderBaseHref("server-1", "base id/unsafe"),
    "/paldefender/bases/base%20id%2Funsafe?serverId=server-1",
  );
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = async (input) => {
    requestedUrl = String(input);
    return Response.json({ baseId: "base-1", level: 2, pals: [] });
  };
  try {
    const base = await getPalDefenderBase("server-1", "base-1");
    assert.equal(
      requestedUrl,
      "/api/servers/server-1/paldefender/bases/base-1",
    );
    assert.equal(base.baseId, "base-1");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("loads normalized PalDefender bases through the PalCenter API", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = async (input) => {
    requestedUrl = String(input);
    return Response.json({
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
  };
  try {
    const bases = await getPalDefenderBases("server-1");
    assert.equal(requestedUrl, "/api/servers/server-1/paldefender/bases");
    assert.equal(bases[0]?.baseId, "base-1");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("builds an encoded PalDefender guild details route", () => {
  assert.equal(
    palDefenderGuildHref("server-1", "guild id/unsafe"),
    "/paldefender/guilds/guild%20id%2Funsafe?serverId=server-1",
  );
});

test("loads PalDefender guild details through the PalCenter API", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = async (input) => {
    requestedUrl = String(input);
    return Response.json({ guildId: "guild-1", name: "Pal Tamers" });
  };
  try {
    const guild = await getPalDefenderGuild("server-1", "guild-1");
    assert.equal(
      requestedUrl,
      "/api/servers/server-1/paldefender/guilds/guild-1",
    );
    assert.equal(guild.guildId, "guild-1");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("loads normalized PalDefender guilds through the PalCenter API", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = async (input) => {
    requestedUrl = String(input);
    return Response.json({
      guilds: [
        {
          guildId: "guild-1",
          name: "Pal Tamers",
          level: 2,
          administrator: { playerId: "player-1", name: "Explorer" },
          baseCount: 0,
          camps: [],
          memberCount: 1,
          memberIds: ["player-1"],
        },
      ],
    });
  };
  try {
    const guilds = await getPalDefenderGuilds("server-1");
    assert.equal(requestedUrl, "/api/servers/server-1/paldefender/guilds");
    assert.equal(guilds[0]?.guildId, "guild-1");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("builds an encoded PalDefender player workspace route", () => {
  assert.equal(
    palDefenderPlayerHref("server-1", "player id/unsafe"),
    "/paldefender/players/player%20id%2Funsafe?serverId=server-1",
  );
});

test("loads server-scoped PalDefender progression without caching", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  let cache: RequestCache | undefined;
  globalThis.fetch = async (input, init) => {
    requestedUrl = String(input);
    cache = init?.cache;
    return Response.json({
      playerId: "player-1",
      character: { level: 6, experience: 1371, unusedStatusPoints: 5 },
    });
  };
  try {
    const progression = await getPalDefenderProgression("server-a", "player-1");
    assert.equal(
      requestedUrl,
      "/api/servers/server-a/paldefender/players/player-1/progression",
    );
    assert.equal(cache, "no-store");
    assert.equal(progression.character.experience, 1371);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("submits a normalized server-scoped progression grant", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  let requestBody = "";
  globalThis.fetch = async (input, init) => {
    requestedUrl = String(input);
    requestBody = String(init?.body);
    return Response.json({
      playerId: "player-1",
      grant: { type: "relic", relicType: "MoveSpeed", amount: 1 },
      totals: { relics: { MoveSpeed: 2 } },
    });
  };
  try {
    await givePalDefenderProgression("server-a", "player-1", {
      type: "relic",
      relicType: "MoveSpeed",
      amount: 1,
    });
    assert.equal(
      requestedUrl,
      "/api/servers/server-a/paldefender/players/player-1/progression",
    );
    assert.deepEqual(JSON.parse(requestBody), {
      type: "relic",
      relicType: "MoveSpeed",
      amount: 1,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("validates broadcast content and counts Unicode characters", () => {
  assert.equal(
    broadcastValidationError(""),
    "Enter a message before sending the broadcast.",
  );
  assert.equal(
    broadcastValidationError(" \n\t "),
    "Enter a message before sending the broadcast.",
  );
  assert.equal(broadcastValidationError("  Hello  "), "");
  assert.equal(broadcastCharacterCount("Pal ⚡"), 5);
});

test("submits a normalized Unicode PalDefender broadcast request", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  let requestBody = "";
  globalThis.fetch = async (input, init) => {
    requestedUrl = String(input);
    requestBody = String(init?.body ?? "");
    return Response.json({ success: true });
  };
  try {
    const message = "Hello, Palpagos! ⚡";
    assert.deepEqual(await broadcastPalDefenderMessage("server-1", message), {
      success: true,
    });
    assert.equal(requestedUrl, "/api/servers/server-1/paldefender/broadcast");
    assert.equal(requestBody, JSON.stringify({ message }));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("submits every documented PalDefender ban option", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  let requestBody = "";
  globalThis.fetch = async (input, init) => {
    requestedUrl = String(input);
    requestBody = String(init?.body ?? "");
    return Response.json({
      success: true,
      playerId: "player-1",
      ipBanned: true,
      bannedIp: "192.0.2.1",
      kickedPlayers: 1,
    });
  };
  try {
    assert.deepEqual(
      await banPalDefenderPlayer("server-1", "player-1", {
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
    assert.equal(
      requestedUrl,
      "/api/servers/server-1/paldefender/players/player-1/ban",
    );
    assert.equal(
      requestBody,
      JSON.stringify({ reason: "Repeated abuse", ipBan: true }),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("submits a normalized PalDefender kick request", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  let requestBody = "";
  globalThis.fetch = async (input, init) => {
    requestedUrl = String(input);
    requestBody = String(init?.body ?? "");
    return Response.json({ success: true, playerId: "player-1" });
  };
  try {
    assert.deepEqual(
      await kickPalDefenderPlayer(
        "server-1",
        "player-1",
        "  Please reconnect  ",
      ),
      { success: true, playerId: "player-1" },
    );
    assert.equal(
      requestedUrl,
      "/api/servers/server-1/paldefender/players/player-1/kick",
    );
    assert.equal(requestBody, JSON.stringify({ message: "Please reconnect" }));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("validates and normalizes PalDefender item grants", () => {
  assert.equal(validateItemGrants([]), "Add at least one item.");
  assert.equal(
    validateItemGrants([{ itemId: "", count: 1 }]),
    "Enter an Item ID for every item.",
  );
  assert.equal(
    validateItemGrants([{ itemId: "Wood", count: 0 }]),
    "Quantities must be positive whole numbers.",
  );
  assert.equal(validateItemGrants([{ itemId: " Wood ", count: "2" }]), null);
  assert.deepEqual(normalizeItemGrants([{ itemId: " Wood ", count: "2" }]), [
    { itemId: "Wood", count: 2 },
  ]);
});

test("submits multiple item grants to the selected PalDefender player", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  let requestBody = "";
  globalThis.fetch = async (input, init) => {
    requestedUrl = String(input);
    requestBody = String(init?.body ?? "");
    return Response.json({ playerId: "player-1", grantedItems: 7 });
  };
  try {
    assert.deepEqual(
      await givePalDefenderItems("server-1", "player-1", [
        { itemId: "CopperIngot", count: 5 },
        { itemId: "Polymer", count: 2 },
      ]),
      { playerId: "player-1", grantedItems: 7 },
    );
    assert.equal(
      requestedUrl,
      "/api/servers/server-1/paldefender/players/player-1/items",
    );
    assert.equal(
      requestBody,
      JSON.stringify({
        items: [
          { itemId: "CopperIngot", count: 5 },
          { itemId: "Polymer", count: 2 },
        ],
      }),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("validates and normalizes a PalDefender Pal grant", () => {
  assert.equal(validatePalGrant({ palId: "", level: 1 }), "Enter a Pal ID.");
  assert.equal(
    validatePalGrant({ palId: "Bad ID", level: 1 }),
    "Pal IDs may contain only letters, numbers, and underscores.",
  );
  assert.equal(
    validatePalGrant({ palId: "Anubis", level: 0 }),
    "Level must be a positive whole number.",
  );
  assert.equal(validatePalGrant({ palId: " Anubis ", level: "35" }), null);
  assert.deepEqual(normalizePalGrant({ palId: " Anubis ", level: "35" }), {
    palId: "Anubis",
    level: 35,
  });
});

test("submits Pal grants to the selected PalDefender player", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  let requestBody = "";
  globalThis.fetch = async (input, init) => {
    requestedUrl = String(input);
    requestBody = String(init?.body ?? "");
    return Response.json({ playerId: "player-1", grantedPals: 1 });
  };
  try {
    assert.deepEqual(
      await givePalDefenderPals("server-1", "player-1", [
        { palId: "Anubis", level: 35 },
      ]),
      { playerId: "player-1", grantedPals: 1 },
    );
    assert.equal(
      requestedUrl,
      "/api/servers/server-1/paldefender/players/player-1/pals",
    );
    assert.equal(
      requestBody,
      JSON.stringify({ pals: [{ palId: "Anubis", level: 35 }] }),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("validates documented Pal template and egg inputs", () => {
  assert.equal(
    validatePalTemplateGrant({ palTemplate: "" }),
    "Enter a Pal template filename.",
  );
  assert.ok(validatePalTemplateGrant({ palTemplate: "../unsafe.json" }));
  assert.equal(
    validatePalTemplateGrant({ palTemplate: " reward-01.json " }),
    null,
  );

  assert.equal(
    validatePalEggGrant({
      mode: "pal-id",
      eggId: "PalEgg_Fire_01",
      palId: "Kitsunebi",
      palTemplate: "",
      level: "",
    }),
    null,
  );
  assert.equal(
    validatePalEggGrant({
      mode: "template",
      eggId: "PalEgg_Dark_01",
      palId: "",
      palTemplate: " reward.json ",
      level: "12",
    }),
    null,
  );
  assert.deepEqual(
    normalizePalEggGrant({
      mode: "template",
      eggId: " PalEgg_Dark_01 ",
      palId: "",
      palTemplate: " reward.json ",
      level: "12",
    }),
    {
      mode: "template",
      eggId: "PalEgg_Dark_01",
      palTemplate: "reward.json",
      level: 12,
    },
  );
});

test("submits server-scoped Pal template and egg grants", async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; body: string }> = [];
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), body: String(init?.body ?? "") });
    return requests.length === 1
      ? Response.json({ playerId: "player-1", grantedPalTemplates: 1 })
      : Response.json({ playerId: "player-1", grantedPalEggs: 1 });
  };
  try {
    await givePalDefenderPalTemplates("server-a", "player-1", ["reward.json"]);
    await givePalDefenderPalEggs("server-b", "player-1", [
      {
        mode: "pal-id",
        eggId: "PalEgg_Fire_01",
        palId: "Kitsunebi",
        level: 12,
      },
    ]);
    assert.deepEqual(requests, [
      {
        url: "/api/servers/server-a/paldefender/players/player-1/pal-templates",
        body: JSON.stringify({ palTemplates: ["reward.json"] }),
      },
      {
        url: "/api/servers/server-b/paldefender/players/player-1/pal-eggs",
        body: JSON.stringify({
          palEggs: [
            {
              mode: "pal-id",
              eggId: "PalEgg_Fire_01",
              palId: "Kitsunebi",
              level: 12,
            },
          ],
        }),
      },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("uses server-scoped moderation read and mutation routes", async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; method: string; body: string }> = [];
  globalThis.fetch = async (input, init) => {
    requests.push({
      url: String(input),
      method: init?.method ?? "GET",
      body: String(init?.body ?? ""),
    });
    return Response.json(
      String(input).endsWith("/moderation")
        ? { version: 1, bannedMessage: "", userBans: [], ipBans: [] }
        : { success: true, target: "ok" },
    );
  };
  try {
    await getModerationState("server-a");
    await unbanModerationUser("server-a", "steam_1", "Appeal accepted");
    await banModerationIp("server-a", "192.0.2.10", "Controlled test");
    await unbanModerationIp("server-a", "192.0.2.10");
    assert.deepEqual(requests, [
      { url: "/api/servers/server-a/moderation", method: "GET", body: "" },
      {
        url: "/api/servers/server-a/moderation/users/steam_1/unban",
        method: "POST",
        body: JSON.stringify({ reason: "Appeal accepted" }),
      },
      {
        url: "/api/servers/server-a/moderation/ip/ban",
        method: "POST",
        body: JSON.stringify({ ip: "192.0.2.10", reason: "Controlled test" }),
      },
      {
        url: "/api/servers/server-a/moderation/ip/unban",
        method: "POST",
        body: JSON.stringify({ ip: "192.0.2.10" }),
      },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("uses server-scoped technology mutation routes with JSON bodies", async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{
    url: string;
    method: string;
    body: string;
    contentType: string | null;
  }> = [];
  globalThis.fetch = async (input, init) => {
    requests.push({
      url: String(input),
      method: init?.method ?? "GET",
      body: String(init?.body ?? ""),
      contentType: new Headers(init?.headers).get("Content-Type"),
    });
    return Response.json({
      changedCount: 1,
      changed: ["Technology_Wood"],
      skipped: [],
    });
  };
  try {
    await learnPalDefenderTechnology("server-a", "player-1", {
      scope: "selected",
      technologyIds: ["Technology_Wood", "Technology_Camp"],
    });
    await forgetPalDefenderTechnology("server-b", "player-2", { scope: "all" });
    assert.deepEqual(requests, [
      {
        url: "/api/servers/server-a/paldefender/players/player-1/technology/learn",
        method: "POST",
        body: JSON.stringify({
          scope: "selected",
          technologyIds: ["Technology_Wood", "Technology_Camp"],
        }),
        contentType: "application/json",
      },
      {
        url: "/api/servers/server-b/paldefender/players/player-2/technology/forget",
        method: "POST",
        body: JSON.stringify({ scope: "all" }),
        contentType: "application/json",
      },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
