import assert from "node:assert/strict";
import test from "node:test";
import { palDefenderPlayerHref } from "../lib/paldefender";
import {
  broadcastCharacterCount,
  broadcastValidationError,
} from "../lib/paldefender-broadcast";
import {
  banPalDefenderPlayer,
  broadcastPalDefenderMessage,
  getPalDefenderGuilds,
  kickPalDefenderPlayer,
} from "../lib/api";

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
    const guilds = await getPalDefenderGuilds();
    assert.equal(requestedUrl, "/api/paldefender/guilds");
    assert.equal(guilds[0]?.guildId, "guild-1");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("builds an encoded PalDefender player workspace route", () => {
  assert.equal(
    palDefenderPlayerHref("player id/unsafe"),
    "/paldefender/players/player%20id%2Funsafe",
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
    assert.deepEqual(await broadcastPalDefenderMessage(message), {
      success: true,
    });
    assert.equal(requestedUrl, "/api/paldefender/broadcast");
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
      await banPalDefenderPlayer("player-1", {
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
    assert.equal(requestedUrl, "/api/paldefender/players/player-1/ban");
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
      await kickPalDefenderPlayer("player-1", "  Please reconnect  "),
      { success: true, playerId: "player-1" },
    );
    assert.equal(requestedUrl, "/api/paldefender/players/player-1/kick");
    assert.equal(requestBody, JSON.stringify({ message: "Please reconnect" }));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
