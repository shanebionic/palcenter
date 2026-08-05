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
      playerActivity: { supported: true, capabilityVersion: "1" },
      coordinateSpaces: { supported: false, capabilityVersion: "1" },
      futureCapability: {
        supported: true,
        capabilityVersion: "7",
        extra: "ignored",
      },
    },
  },
};

test("parses bounded authenticated player activity and ignores unknown fields", async () => {
  const requests: Array<{ url: string; authorization: string | null }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    requests.push({
      url: url.toString(),
      authorization: new Headers(init?.headers).get("authorization"),
    });
    if (url.pathname.endsWith("/activity")) {
      return json({
        schemaVersion: "1",
        restartBehavior: "memory_only",
        unknownEnvelopeField: true,
        activity: [
          {
            eventId: "event-one",
            eventType: "player_joined",
            timestamp: "2026-08-03T12:00:00.000Z",
            serverInstanceId: "instance",
            player: {
              userId: "user-one",
              playerId: "player-one",
              name: "Denalb",
            },
            sessionId: "session-one",
            source: "palworld_server_hook",
            schemaVersion: "1",
            durationSeconds: null,
            metadata: { future: "ignored safely" },
            futureRecordField: true,
          },
        ],
      });
    }
    return json(documents[url.pathname.split("/").at(-1) ?? ""]);
  };
  const service = new CompanionDiscoveryService(
    repository(base),
    100,
    30_000,
    fetcher,
  );
  const activity = await service.activity(base.id, {
    after: "2026-08-03T11:00:00.000Z",
    player: "user-one",
    limit: 25,
  });
  assert.equal(activity.length, 1);
  assert.equal(activity[0]?.player.name, "Denalb");
  const request = requests.find(({ url }) => url.includes("/activity?"));
  assert.equal(request?.authorization, "Bearer secret");
  assert.match(request?.url ?? "", /limit=25/);
  assert.match(request?.url ?? "", /player=user-one/);
});

test("accepts only explicit Companion coordinate spaces for live locations", async () => {
  const fetcher: typeof fetch = async (input) => {
    const key = new URL(String(input)).pathname.split("/").at(-1) ?? "";
    if (key === "capabilities")
      return json({
        categories: {
          playerLocations: { supported: true, capabilityVersion: "1" },
          coordinateSpaces: { supported: true, capabilityVersion: "1" },
        },
      });
    if (key === "locations")
      return json({
        locations: [
          {
            player: {
              userId: "user-one",
              playerId: "player-one",
              name: "Denalb",
            },
            position: { x: 10, y: 20, z: 30 },
            coordinateSpaceId: "special_area",
            stageInstanceId: "ABC",
            capturedAt: "2026-08-03T12:00:00.000Z",
            source: "palworld_server_state",
          },
        ],
      });
    return json(documents[key]);
  };
  const service = new CompanionDiscoveryService(
    repository(base),
    100,
    0,
    fetcher,
  );
  const locations = await service.locations(base.id);
  assert.equal(locations?.[0]?.coordinateSpaceId, "special_area");
  assert.equal(locations?.[0]?.position.x, 10);
});

test("uses the version 2 map-teleport contract without a caller-provided height", async () => {
  let sentBody: unknown = null;
  const fetcher: typeof fetch = async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith("/capabilities"))
      return json({
        categories: {
          adminActions: {
            supported: true,
            capabilityVersion: "2",
            actions: { teleportPlayerToLocation: true },
          },
        },
      });
    if (path.endsWith("/teleport-player-to-location")) {
      sentBody = JSON.parse(String(init?.body));
      return json({
        requestId: "pc-request-123",
        action: "teleportPlayerToLocation",
        status: "succeeded",
        error: null,
        message: "Teleported safely.",
        resolvedDestination: { x: 100, y: 200, z: 345 },
      });
    }
    return json(documents[path.split("/").at(-1) ?? ""]);
  };
  const service = new CompanionDiscoveryService(repository(base), 100, 0, fetcher);
  const result = await service.adminAction(base.id, "teleportPlayerToLocation", {
    requestId: "pc-request-123",
    administratorPlayerId: "0123456789abcdef0123456789abcdef",
    targetPlayerId: "fedcba9876543210fedcba9876543210",
    coordinateSpace: "palpagos",
    x: 100,
    y: 200,
    verification: "palpagos_map",
  });

  assert.deepEqual(sentBody, {
    requestId: "pc-request-123",
    administratorPlayerId: "0123456789abcdef0123456789abcdef",
    targetPlayerId: "fedcba9876543210fedcba9876543210",
    coordinateSpace: "palpagos",
    x: 100,
    y: 200,
    verification: "palpagos_map",
  });
  assert.deepEqual(result.resolvedDestination, { x: 100, y: 200, z: 345 });
});

test("does not send safe-height map teleports to an older Companion contract", async () => {
  const service = new CompanionDiscoveryService(repository(base), 100, 0, async (input) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith("/capabilities"))
      return json({
        categories: {
          adminActions: {
            supported: true,
            capabilityVersion: "1",
            actions: { teleportPlayerToLocation: true },
          },
        },
      });
    return json(documents[path.split("/").at(-1) ?? ""]);
  });

  await assert.rejects(
    service.adminAction(base.id, "teleportPlayerToLocation", {
      requestId: "pc-request-123",
      administratorPlayerId: "0123456789abcdef0123456789abcdef",
      targetPlayerId: "fedcba9876543210fedcba9876543210",
      coordinateSpace: "palpagos",
      x: 100,
      y: 200,
      verification: "palpagos_map",
    }),
    /does not support safe-height map teleports/,
  );
});
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
  assert.equal(result.capabilities.coordinateSpaces?.supported, false);
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
