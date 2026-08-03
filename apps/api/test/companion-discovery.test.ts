import assert from "node:assert/strict";
import test from "node:test";
import type { ConnectionRepository } from "../src/repositories/connection-repository.js";
import { CompanionDiscoveryService } from "../src/services/companion-discovery-service.js";
import type { StoredConnection } from "../src/types/connections.js";

const connection: StoredConnection = {
  id: "srv_test",
  name: "Test",
  baseUrl: "http://palserver:8212",
  adminPassword: "private",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
const repository: ConnectionRepository = {
  initialize: async () => undefined,
  list: async () => [connection],
  get: async () => connection,
  create: async () => undefined,
  update: async () => undefined,
  delete: async () => undefined,
};

const documents: Record<string, unknown> = {
  health: {
    status: "healthy",
    applicationVersion: "0.1.0",
    apiVersion: "v1",
    startedAt: new Date().toISOString(),
    uptimeSeconds: 30,
    instanceId: "instance",
    checks: { configuration: "healthy" },
  },
  version: {
    applicationVersion: "0.1.0",
    apiVersion: "v1",
    buildCommit: "abc1234",
    compatibility: {},
  },
  capabilities: {
    schemaVersion: "1",
    categories: {
      health: { supported: true, capabilityVersion: "1" },
      futureCapability: {
        supported: true,
        capabilityVersion: "7",
        extra: "ignored",
      },
    },
  },
};

test("discovers structured capabilities and safely preserves unknown categories", async () => {
  const fetcher: typeof fetch = async (input) => {
    const key = new URL(String(input)).pathname.split("/").at(-1) ?? "";
    return new Response(JSON.stringify(documents[key]), { status: 200 });
  };
  const result = await new CompanionDiscoveryService(
    repository,
    100,
    0,
    fetcher,
  ).discover("srv_test");
  assert.equal(result.status, "connected");
  assert.equal(result.capabilities.health?.supported, true);
  assert.equal(result.capabilities.futureCapability?.capabilityVersion, "7");
});

test("normal operation continues for unavailable and malformed companions", async () => {
  const unavailable = await new CompanionDiscoveryService(
    repository,
    100,
    0,
    async () => {
      throw new Error("offline");
    },
  ).discover("srv_test");
  assert.equal(unavailable.status, "unavailable");
  const malformed = await new CompanionDiscoveryService(
    repository,
    100,
    0,
    async () => new Response("not-json"),
  ).discover("srv_test");
  assert.equal(malformed.reason, "invalid_response");
});

test("supports older flat boolean capability documents", async () => {
  const fetcher: typeof fetch = async (input) => {
    const key = new URL(String(input)).pathname.split("/").at(-1) ?? "";
    return new Response(
      JSON.stringify(
        key === "capabilities"
          ? { events: false, health: true }
          : documents[key],
      ),
    );
  };
  const result = await new CompanionDiscoveryService(
    repository,
    100,
    0,
    fetcher,
  ).discover("srv_test");
  assert.equal(result.capabilities.health?.supported, true);
  assert.equal(result.capabilities.health?.capabilityVersion, "legacy");
});
