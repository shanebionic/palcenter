import assert from "node:assert/strict";
import { test } from "node:test";
import type { ConnectionRepository } from "../src/repositories/connection-repository.js";
import {
  ServerAdminService,
  type BroadcastProvider,
} from "../src/services/server-admin-service.js";
import type { PalDefenderStatus } from "../src/services/paldefender-service.js";
import type { StoredConnection } from "../src/types/connections.js";

const connection = (id: string): StoredConnection => ({
  id,
  name: id,
  baseUrl: `http://${id}.palworld`,
  adminPassword: `password-${id}`,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
});

const status = (state: PalDefenderStatus["state"]): PalDefenderStatus => ({
  state,
  enabled: state !== "disabled",
  configured: !["disabled", "configuration_required"].includes(state),
  connected: state === "connected",
  version: state === "connected" ? "1.8.3" : "Unavailable",
  responseTime: state === "connected" ? 4 : 0,
});

function fixture(states: Record<string, PalDefenderStatus["state"]>) {
  const servers = new Map(
    Object.keys(states).map((id) => [id, connection(id)]),
  );
  const repository = {
    get: async (id: string) => servers.get(id) ?? null,
  } as ConnectionRepository;
  const calls: Array<{
    provider: BroadcastProvider;
    serverId: string;
    message: string;
  }> = [];
  const nativeClients: Array<{ baseUrl: string; adminPassword: string }> = [];
  const nativeOperations: string[] = [];
  const palDefender = {
    status: async (serverId: string) => status(states[serverId]!),
    broadcast: async (serverId: string, message: string) => {
      calls.push({ provider: "paldefender", serverId, message });
    },
  };
  const service = new ServerAdminService(
    repository,
    palDefender,
    (baseUrl, adminPassword) => {
      nativeClients.push({ baseUrl, adminPassword });
      return {
        announce: async (message: string) => {
          const serverId = baseUrl.split("//")[1]!.split(".")[0]!;
          calls.push({ provider: "native", serverId, message });
        },
        saveWorld: async () => {
          nativeOperations.push(`save:${baseUrl}`);
        },
        shutdown: async (waitTime, message) => {
          nativeOperations.push(
            `shutdown:${baseUrl}:${waitTime}:${message ?? ""}`,
          );
        },
        stop: async () => {
          nativeOperations.push(`stop:${baseUrl}`);
        },
      };
    },
  );
  return { service, calls, nativeClients, nativeOperations, palDefender };
}

test("broadcast prefers connected PalDefender and safely selects native otherwise", async () => {
  const { service, calls, nativeClients } = fixture({
    connected: "connected",
    disabled: "disabled",
    unreachable: "unreachable",
    unauthorized: "authentication_failed",
  });

  assert.deepEqual(await service.announce("connected", "PalDefender message"), {
    provider: "paldefender",
  });
  assert.deepEqual(await service.announce("disabled", "Native disabled"), {
    provider: "native",
  });
  assert.deepEqual(await service.announce("unreachable", "Native fallback"), {
    provider: "native",
  });
  assert.deepEqual(
    await service.announce("unauthorized", "Native auth fallback"),
    {
      provider: "native",
    },
  );

  assert.deepEqual(calls, [
    {
      provider: "paldefender",
      serverId: "connected",
      message: "PalDefender message",
    },
    { provider: "native", serverId: "disabled", message: "Native disabled" },
    {
      provider: "native",
      serverId: "unreachable",
      message: "Native fallback",
    },
    {
      provider: "native",
      serverId: "unauthorized",
      message: "Native auth fallback",
    },
  ]);
  assert.deepEqual(nativeClients, [
    {
      baseUrl: "http://disabled.palworld",
      adminPassword: "password-disabled",
    },
    {
      baseUrl: "http://unreachable.palworld",
      adminPassword: "password-unreachable",
    },
    {
      baseUrl: "http://unauthorized.palworld",
      adminPassword: "password-unauthorized",
    },
  ]);
});

test("save, shutdown, and stop remain native and server-scoped", async () => {
  const { service, nativeClients, nativeOperations } = fixture({
    connected: "connected",
  });

  await service.saveWorld("connected");
  await service.shutdown("connected", 60, "Maintenance");
  await service.stop("connected");

  assert.deepEqual(nativeOperations, [
    "save:http://connected.palworld",
    "shutdown:http://connected.palworld:60:Maintenance",
    "stop:http://connected.palworld",
  ]);
  assert.deepEqual(nativeClients, [
    {
      baseUrl: "http://connected.palworld",
      adminPassword: "password-connected",
    },
    {
      baseUrl: "http://connected.palworld",
      adminPassword: "password-connected",
    },
    {
      baseUrl: "http://connected.palworld",
      adminPassword: "password-connected",
    },
  ]);
});

test("broadcast never retries through native after a PalDefender write is attempted", async () => {
  const { service, calls, nativeClients, palDefender } = fixture({
    connected: "connected",
  });
  palDefender.broadcast = async () => {
    throw new Error("outcome unknown after timeout");
  };

  await assert.rejects(
    service.announce("connected", "Send exactly once"),
    /outcome unknown/,
  );
  assert.deepEqual(calls, []);
  assert.deepEqual(nativeClients, []);
});
