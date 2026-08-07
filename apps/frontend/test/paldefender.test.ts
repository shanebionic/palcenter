import assert from "node:assert/strict";
import test from "node:test";
import { palDefenderPlayerHref } from "../lib/paldefender";
import { kickPalDefenderPlayer } from "../lib/api";

test("builds an encoded PalDefender player workspace route", () => {
  assert.equal(
    palDefenderPlayerHref("player id/unsafe"),
    "/paldefender/players/player%20id%2Funsafe",
  );
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
