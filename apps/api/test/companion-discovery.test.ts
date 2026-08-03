import assert from "node:assert/strict";
import test from "node:test";
import type { ConnectionRepository } from "../src/repositories/connection-repository.js";
import { CompanionDiscoveryService } from "../src/services/companion-discovery-service.js";
import type { StoredConnection } from "../src/types/connections.js";

const base: StoredConnection = {
  id: "srv_test",
  name: "Test",
  baseUrl: "http://palserver:8212",
  adminPassword: "private",
  companionEnabled: true,
  companionPort: 8213,
  companionApiToken: "secret",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
const repository = (connection: StoredConnection): ConnectionRepository => ({
  initialize: async () => undefined,
  list: async () => [connection],
  get: async () => connection,
  create: async () => undefined,
  update: async () => undefined,
  delete: async () => undefined,
});
const documents: Record<string, unknown> = {
  health: { status: "healthy" },
  version: {
    applicationVersion: "0.1.0",
    apiVersion: "v1",
    buildCommit: "abc1234",
    compatibility: {},
    runtime: {
      startedAt: new Date().toISOString(),
      uptimeSeconds: 30,
      instanceId: "instance",
      checks: { configuration: "healthy" },
    },
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
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

test("derives defaults, sends bearer auth, and preserves unknown capabilities", async () => {
  const requests: Array<{ url: string; authorization: string | null }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    requests.push({
      url: url.toString(),
      authorization: new Headers(init?.headers).get("authorization"),
    });
    return json(documents[url.pathname.split("/").at(-1) ?? ""]);
  };
  const result = await new CompanionDiscoveryService(
    repository(base),
    100,
    0,
    fetcher,
  ).discover(base.id);
  assert.equal(result.state, "connected");
  assert.equal(requests[0]?.url, "http://palserver:8213/palcenter/v1/health");
  assert.equal(requests[0]?.authorization, null);
  assert.equal(requests[1]?.authorization, "Bearer secret");
  assert.equal(result.capabilities.futureCapability?.capabilityVersion, "7");
});

test("honors explicit host and port overrides", async () => {
  let requested = "";
  const connection = {
    ...base,
    companionHost: "companion.internal",
    companionPort: 18213,
  };
  const fetcher: typeof fetch = async (input) => {
    requested = String(input);
    return json(documents[new URL(requested).pathname.split("/").at(-1) ?? ""]);
  };
  await new CompanionDiscoveryService(
    repository(connection),
    100,
    0,
    fetcher,
  ).discover(base.id);
  assert.match(requested, /^http:\/\/companion\.internal:18213\//);
});

test("distinguishes missing and invalid authentication without disrupting discovery", async () => {
  const detected = await new CompanionDiscoveryService(
    repository({ ...base, companionApiToken: "" }),
    100,
    0,
    async () => json(documents.health),
  ).discover(base.id);
  assert.equal(detected.state, "authentication_required");
  const failed = await new CompanionDiscoveryService(
    repository(base),
    100,
    0,
    async (input) =>
      new URL(String(input)).pathname.endsWith("health")
        ? json(documents.health)
        : json({ error: "authentication_required" }, 401),
  ).discover(base.id);
  assert.equal(failed.state, "authentication_failed");
});

test("handles unreachable, malformed, incompatible, legacy, and future responses", async () => {
  const unreachable = await new CompanionDiscoveryService(
    repository(base),
    100,
    0,
    async () => {
      throw new Error("offline");
    },
  ).discover(base.id);
  assert.equal(unreachable.state, "unreachable");
  const malformed = await new CompanionDiscoveryService(
    repository(base),
    100,
    0,
    async () =>
      new Response("not-json", {
        headers: { "content-type": "application/json" },
      }),
  ).discover(base.id);
  assert.equal(malformed.state, "malformed_response");
  const incompatible = await new CompanionDiscoveryService(
    repository(base),
    100,
    0,
    async (input) => {
      const key = new URL(String(input)).pathname.split("/").at(-1) ?? "";
      return json(
        key === "version"
          ? { ...(documents.version as object), apiVersion: "v2" }
          : documents[key],
      );
    },
  ).discover(base.id);
  assert.equal(incompatible.state, "incompatible_contract");
  const legacy = await new CompanionDiscoveryService(
    repository(base),
    100,
    0,
    async (input) => {
      const key = new URL(String(input)).pathname.split("/").at(-1) ?? "";
      return json(
        key === "capabilities"
          ? { events: false, health: true }
          : documents[key],
      );
    },
  ).discover(base.id);
  assert.equal(legacy.capabilities.health?.capabilityVersion, "legacy");
});

test("reuses request-driven cache and manual refresh bypasses it", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async (input) => {
    calls += 1;
    const key = new URL(String(input)).pathname.split("/").at(-1) ?? "";
    return json(documents[key]);
  };
  const service = new CompanionDiscoveryService(
    repository(base),
    100,
    60_000,
    fetcher,
  );
  await service.discover(base.id);
  await service.discover(base.id);
  assert.equal(calls, 3);
  await service.discover(base.id, true);
  assert.equal(calls, 6);
});
