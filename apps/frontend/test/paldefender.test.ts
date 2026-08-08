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
  givePalDefenderItems,
  givePalDefenderPals,
  kickPalDefenderPlayer,
} from "../lib/api";
import {
  normalizeItemGrants,
  validateItemGrants,
} from "../lib/paldefender-items";
import { normalizePalGrant, validatePalGrant } from "../lib/paldefender-pals";

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
