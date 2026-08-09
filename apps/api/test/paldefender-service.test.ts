import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PalDefenderError,
  type PalDefenderClient,
} from "../src/clients/paldefender-client.js";
import type { ConnectionRepository } from "../src/repositories/connection-repository.js";
import { PalDefenderService } from "../src/services/paldefender-service.js";
import type { StoredConnection } from "../src/types/connections.js";

const connection = (
  id: string,
  endpoint: string | null,
  token: string,
  enabled = true,
): StoredConnection => ({
  id,
  name: id,
  baseUrl: `http://${id}.palworld`,
  adminPassword: "admin-password",
  palDefenderEnabled: enabled,
  palDefenderEndpoint: endpoint,
  palDefenderToken: token,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
});

test("PalDefender requests use only the selected server credentials", async () => {
  const servers = new Map([
    ["server-a", connection("server-a", "http://paldefender-a", "token-a")],
    ["server-b", connection("server-b", "http://paldefender-b", "token-b")],
    ["server-c", connection("server-c", null, "", false)],
  ]);
  const repository = {
    get: async (id: string) => servers.get(id) ?? null,
  } as ConnectionRepository;
  const created: Array<{ endpoint: string; token: string }> = [];
  const service = new PalDefenderService(repository, (endpoint, token) => {
    created.push({ endpoint, token });
    return {
      getPlayers: async () => [
        {
          name: endpoint.endsWith("-a") ? "Player A" : "Player B",
          playerId: token,
          online: true,
          guild: null,
          level: null,
        },
      ],
    } as PalDefenderClient;
  });

  const [playersA, playersB] = await Promise.all([
    service.players("server-a"),
    service.players("server-b"),
  ]);

  assert.equal(playersA[0]?.name, "Player A");
  assert.equal(playersB[0]?.name, "Player B");
  assert.deepEqual(created, [
    { endpoint: "http://paldefender-a", token: "token-a" },
    { endpoint: "http://paldefender-b", token: "token-b" },
  ]);

  const disabled = await service.status("server-c");
  assert.equal(disabled.connected, false);
  assert.equal(disabled.enabled, false);
  assert.equal(disabled.state, "disabled");
  assert.equal(created.length, 2, "disabled Server C must make no request");
});

test("status distinguishes optional-provider authentication and availability failures", async () => {
  const servers = new Map([
    ["auth", connection("auth", "http://auth", "token")],
    ["offline", connection("offline", "http://offline", "token")],
  ]);
  const repository = {
    get: async (id: string) => servers.get(id) ?? null,
  } as ConnectionRepository;
  const service = new PalDefenderService(
    repository,
    (endpoint) =>
      ({
        getVersion: async () => {
          if (endpoint.endsWith("auth")) {
            throw new PalDefenderError("Unauthorized", 401, "UNAUTHORIZED");
          }
          throw new PalDefenderError(
            "Unable to reach PalDefender.",
            undefined,
            "CONNECTION_FAILED",
          );
        },
      }) as PalDefenderClient,
  );

  assert.equal((await service.status("auth")).state, "authentication_failed");
  assert.equal((await service.status("offline")).state, "unreachable");
});

test("progression stays isolated per server and disabled servers make no request", async () => {
  const servers = new Map([
    ["server-a", connection("server-a", "http://progression-a", "token-a")],
    ["server-b", connection("server-b", null, "", false)],
    ["server-c", connection("server-c", "http://progression-c", "token-c")],
  ]);
  const repository = {
    get: async (id: string) => servers.get(id) ?? null,
  } as ConnectionRepository;
  const created: Array<{ endpoint: string; token: string }> = [];
  const service = new PalDefenderService(repository, (endpoint, token) => {
    created.push({ endpoint, token });
    return {
      getProgression: async () => {
        if (endpoint.endsWith("-c"))
          throw new PalDefenderError(
            "Unable to reach PalDefender.",
            undefined,
            "CONNECTION_FAILED",
          );
        return { playerId: "player-a", character: { level: 6 } };
      },
      giveProgression: async (_playerId, grant) => {
        if (endpoint.endsWith("-c"))
          throw new PalDefenderError(
            "Unable to reach PalDefender.",
            undefined,
            "CONNECTION_FAILED",
          );
        return { playerId: "player-a", grant, totals: {} };
      },
    } as unknown as PalDefenderClient;
  });

  const progression = await service.progression("server-a", "player-a");
  assert.equal(progression.playerId, "player-a");
  const granted = await service.giveProgression("server-a", "player-a", {
    type: "experience",
    amount: 1,
  });
  assert.equal(granted.playerId, "player-a");
  await assert.rejects(() => service.progression("server-b", "player-b"), {
    name: "PalDefenderDisabledError",
  });
  await assert.rejects(() => service.progression("server-c", "player-c"), {
    name: "PalDefenderError",
  });
  await assert.rejects(
    () =>
      service.giveProgression("server-b", "player-b", {
        type: "technologyPoints",
        amount: 1,
      }),
    { name: "PalDefenderDisabledError" },
  );
  await assert.rejects(
    () =>
      service.giveProgression("server-c", "player-c", {
        type: "experience",
        amount: 1,
      }),
    { name: "PalDefenderError" },
  );
  assert.deepEqual(created, [
    { endpoint: "http://progression-a", token: "token-a" },
    { endpoint: "http://progression-a", token: "token-a" },
    { endpoint: "http://progression-c", token: "token-c" },
    { endpoint: "http://progression-c", token: "token-c" },
  ]);
});

test("known progression levels enrich player reads without per-player requests", async () => {
  const repository = {
    get: async () => connection("server-a", "http://progression-a", "token-a"),
  } as ConnectionRepository;
  let progressionRequests = 0;
  const service = new PalDefenderService(
    repository,
    () =>
      ({
        getPlayers: async () => [
          {
            name: "Denalb",
            playerId: "0094A2FA000000000000000000000000",
            online: true,
            guild: "Pal Tamers",
            level: null,
          },
        ],
        getPlayer: async () => ({
          name: "Denalb",
          playerId: "0094A2FA000000000000000000000000",
          online: true,
          guild: "Pal Tamers",
          level: null,
        }),
        getProgression: async () => {
          progressionRequests += 1;
          return {
            playerId: "0094A2FA-00000000-00000000-00000000",
            character: { level: 80 },
          };
        },
      }) as unknown as PalDefenderClient,
  );

  assert.equal((await service.players("server-a"))[0]?.level, null);
  await service.progression("server-a", "0094A2FA000000000000000000000000");
  assert.equal((await service.players("server-a"))[0]?.level, 80);
  assert.equal(
    (await service.player("server-a", "0094A2FA000000000000000000000000"))
      .level,
    80,
  );
  assert.equal(progressionRequests, 1);
});

test("candidate connection tests preserve a saved token only for the selected server", async () => {
  const servers = new Map([
    ["server-a", connection("server-a", "http://saved-a", "saved-token-a")],
    ["server-b", connection("server-b", "http://saved-b", "saved-token-b")],
  ]);
  const repository = {
    get: async (id: string) => servers.get(id) ?? null,
  } as ConnectionRepository;
  const created: Array<{ endpoint: string; token: string }> = [];
  const service = new PalDefenderService(repository, (endpoint, token) => {
    created.push({ endpoint, token });
    return { getVersion: async () => "1.8.3" } as PalDefenderClient;
  });

  await service.testForServer("server-a", "http://candidate-a");
  await service.testForServer(
    "server-b",
    "http://candidate-b",
    "replacement-b",
  );

  assert.deepEqual(created, [
    { endpoint: "http://candidate-a", token: "saved-token-a" },
    { endpoint: "http://candidate-b", token: "replacement-b" },
  ]);
});
