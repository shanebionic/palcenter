import assert from "node:assert/strict";
import test from "node:test";
import type { StoredConnection } from "../src/types/connections.js";
import { PalworldRestClient } from "../src/clients/palworld-rest-client.js";
import { NativeRestPlayerTelemetryProvider } from "../src/telemetry/providers/native-rest-provider.js";

function connection(): StoredConnection {
  return {
    id: "srv",
    name: "srv",
    baseUrl: "http://server:8212",
    adminPassword: "pw",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const capturedAt = "2026-01-01T12:00:00.000Z";

function mockRestClient(
  playersResp: Awaited<
    ReturnType<typeof PalworldRestClient.prototype.getPlayers>
  >,
) {
  return {
    getPlayers: async () => playersResp,
  } as unknown as PalworldRestClient;
}

test('Native REST literal "None" playerId normalizes to null', async () => {
  const provider = new NativeRestPlayerTelemetryProvider(() =>
    mockRestClient({
      players: [
        {
          name: "PlayerA",
          accountName: "acc-a",
          playerId: "None",
          userId: "steam:111",
          ping: 20,
          location_x: 100,
          location_y: 200,
          level: 5,
          building_count: 0,
        },
      ],
    }),
  );

  const results = await provider.collect(connection(), capturedAt);

  assert.equal(results.length, 1);
  assert.equal(results[0].userId, "steam:111");
  assert.equal(results[0].playerId, null, '"None" should become null');
});

test("Native REST normal playerId passes through", async () => {
  const provider = new NativeRestPlayerTelemetryProvider(() =>
    mockRestClient({
      players: [
        {
          name: "PlayerB",
          accountName: null,
          playerId: "E:00000000000000000000000000000002",
          userId: "steam:222",
          ping: 30,
          location_x: 0,
          location_y: 0,
          level: 10,
          building_count: 1,
        },
      ],
    }),
  );

  const results = await provider.collect(connection(), capturedAt);

  assert.equal(results.length, 1);
  assert.equal(results[0].userId, "steam:222");
  assert.equal(results[0].playerId, "E:00000000000000000000000000000002");
});

test("Native REST null playerId stays null", async () => {
  const provider = new NativeRestPlayerTelemetryProvider(() =>
    mockRestClient({
      players: [
        {
          name: "PlayerC",
          accountName: null,
          playerId: null,
          userId: "steam:333",
          ping: 25,
          location_x: 50,
          location_y: 50,
          level: 3,
          building_count: 0,
        },
      ],
    }),
  );

  const results = await provider.collect(connection(), capturedAt);

  assert.equal(results.length, 1);
  assert.equal(results[0].playerId, null);
});

test("Native REST skips players with empty userId", async () => {
  const provider = new NativeRestPlayerTelemetryProvider(() =>
    mockRestClient({
      players: [
        {
          name: "BadPlayer",
          accountName: null,
          playerId: "pid-1",
          userId: "",
          ping: 0,
          location_x: 0,
          location_y: 0,
          level: 0,
          building_count: 0,
        },
        {
          name: "GoodPlayer",
          accountName: null,
          playerId: "pid-2",
          userId: "steam:444",
          ping: 10,
          location_x: 10,
          location_y: 20,
          level: 5,
          building_count: 0,
        },
      ],
    }),
  );

  const results = await provider.collect(connection(), capturedAt);

  assert.equal(results.length, 1, "empty userId player should be skipped");
  assert.equal(results[0].userId, "steam:444");
});
