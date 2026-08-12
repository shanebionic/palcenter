import assert from "node:assert/strict";
import test from "node:test";
import type { StoredConnection } from "../src/types/connections.js";
import { PalDefenderClient } from "../src/clients/paldefender-client.js";
import { PalDefenderPlayerTelemetryProvider } from "../src/telemetry/providers/paldefender-provider.js";

function connection(): StoredConnection {
  return {
    id: "srv",
    name: "srv",
    baseUrl: "http://server:8212",
    adminPassword: "pw",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    palDefenderEnabled: true,
    palDefenderEndpoint: "http://paldefender",
    palDefenderToken: "token",
  };
}

function mockClient(
  players: ReturnType<typeof PalDefenderClient.prototype.getPlayers>,
  getPlayer: (
    uid: string,
  ) => ReturnType<typeof PalDefenderClient.prototype.getPlayer>,
) {
  return {
    getPlayers: async () => players,
    getPlayer: async (uid: string) => getPlayer(uid),
    ["baseUrl"]: "http://paldefender",
    ["token"]: "token",
  } as unknown as PalDefenderClient;
}

const capturedAt = "2026-01-01T12:00:00.000Z";

test("skips offline players and does not fetch their details", async () => {
  const detailRequests: string[] = [];
  const conn = connection();
  const provider = new PalDefenderPlayerTelemetryProvider(() =>
    mockClient(
      [
        {
          name: "Alice",
          playerId: "uid-1",
          online: true,
          guild: null,
          level: null,
        },
        {
          name: "Bob",
          playerId: "uid-2",
          online: false,
          guild: null,
          level: null,
        },
      ],
      async (uid: string) => {
        detailRequests.push(uid);
        return {
          name: uid === "uid-1" ? "Alice" : "Bob",
          playerId: uid,
          online: uid === "uid-1",
          guild: null,
          level: null,
          worldLocation: { x: 100, y: 200, z: 300 },
          mapLocation: null,
        };
      },
    ),
  );

  const results = await provider.collect(conn, capturedAt);

  assert.equal(results.length, 1, "should return only online player");
  assert.equal(results[0].playerId, "uid-1");
  assert.equal(results[0].x, 100);
  assert.equal(
    detailRequests.length,
    1,
    "should only fetch details for online players",
  );
  assert.equal(detailRequests[0], "uid-1");
});

test("returns empty array when all players are offline", async () => {
  const detailRequests: string[] = [];
  const conn = connection();
  const provider = new PalDefenderPlayerTelemetryProvider(() =>
    mockClient(
      [
        {
          name: "Alice",
          playerId: "uid-1",
          online: false,
          guild: null,
          level: null,
        },
        {
          name: "Bob",
          playerId: "uid-2",
          online: false,
          guild: null,
          level: null,
        },
      ],
      async (uid: string) => {
        detailRequests.push(uid);
        return {
          name: "Nobody",
          playerId: uid,
          online: false,
          guild: null,
          level: null,
          worldLocation: null,
          mapLocation: null,
        };
      },
    ),
  );

  const results = await provider.collect(conn, capturedAt);

  assert.equal(results.length, 0, "should return empty array");
  assert.equal(detailRequests.length, 0, "should not fetch any details");
});

test("returns empty array when roster is empty", async () => {
  const conn = connection();
  const provider = new PalDefenderPlayerTelemetryProvider(() =>
    mockClient([], async (uid: string) => ({
      name: "Nobody",
      playerId: uid,
      online: false,
      guild: null,
      level: null,
      worldLocation: null,
      mapLocation: null,
    })),
  );

  const results = await provider.collect(conn, capturedAt);
  assert.equal(results.length, 0, "should return empty array for empty roster");
});

test("throws when PalDefender is not enabled", async () => {
  const conn = { ...connection(), palDefenderEnabled: false };
  const provider = new PalDefenderPlayerTelemetryProvider();

  await assert.rejects(
    () => provider.collect(conn, capturedAt),
    /PalDefender is not configured/,
  );
});

test("normalizes world location for multiple online players", async () => {
  const conn = connection();
  const provider = new PalDefenderPlayerTelemetryProvider(() =>
    mockClient(
      [
        {
          name: "Alice",
          playerId: "uid-1",
          online: true,
          guild: "GuildA",
          level: 5,
        },
        {
          name: "Bob",
          playerId: "uid-2",
          online: true,
          guild: "GuildB",
          level: 10,
        },
        {
          name: "Charlie",
          playerId: "uid-3",
          online: false,
          guild: null,
          level: null,
        },
      ],
      async (uid: string) => {
        const data =
          uid === "uid-1"
            ? {
                name: "Alice",
                playerId: "uid-1",
                guild: "GuildA",
                level: 5,
                worldLocation: { x: 100, y: 200, z: 300 },
              }
            : {
                name: "Bob",
                playerId: "uid-2",
                guild: "GuildB",
                level: 10,
                worldLocation: { x: 400, y: 500, z: 600 },
              };
        return {
          ...data,
          online: true,
          mapLocation: null,
        };
      },
    ),
  );

  const results = await provider.collect(conn, capturedAt);

  assert.equal(results.length, 2, "should return only online players");
  const alice = results.find((r) => r.playerId === "uid-1");
  const bob = results.find((r) => r.playerId === "uid-2");
  assert.ok(alice, "Alice should be present");
  assert.ok(bob, "Bob should be present");
  assert.equal(alice!.x, 100);
  assert.equal(alice!.y, 200);
  assert.equal(alice!.z, 300);
  assert.equal(alice!.guildName, "GuildA");
  assert.equal(alice!.level, 5);
  assert.equal(bob!.x, 400);
  assert.equal(bob!.y, 500);
  assert.equal(bob!.z, 600);
  assert.equal(bob!.guildName, "GuildB");
  assert.equal(bob!.level, 10);
});

test("returns null coordinates for online player with null world location", async () => {
  const conn = connection();
  const provider = new PalDefenderPlayerTelemetryProvider(() =>
    mockClient(
      [
        {
          name: "Alice",
          playerId: "uid-1",
          online: true,
          guild: null,
          level: null,
        },
      ],
      async () => ({
        name: "Alice",
        playerId: "uid-1",
        online: true,
        guild: null,
        level: null,
        worldLocation: null,
        mapLocation: null,
      }),
    ),
  );

  const results = await provider.collect(conn, capturedAt);

  assert.equal(results.length, 1);
  assert.equal(results[0].x, null);
  assert.equal(results[0].y, null);
  assert.equal(results[0].z, null);
});

test("normalizes player name and trims whitespace", async () => {
  const conn = connection();
  const provider = new PalDefenderPlayerTelemetryProvider(() =>
    mockClient(
      [
        {
          name: "  Alice  ",
          playerId: "uid-1",
          online: true,
          guild: null,
          level: null,
        },
      ],
      async () => ({
        name: "  Alice  ",
        playerId: "uid-1",
        online: true,
        guild: "  GuildA  ",
        level: 5,
        worldLocation: { x: 100, y: 200 },
        mapLocation: null,
      }),
    ),
  );

  const results = await provider.collect(conn, capturedAt);

  assert.equal(results.length, 1);
  assert.equal(results[0].playerName, "Alice");
  assert.equal(results[0].guildName, "GuildA");
});
