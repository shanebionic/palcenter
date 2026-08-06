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
