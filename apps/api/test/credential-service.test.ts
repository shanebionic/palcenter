import assert from "node:assert/strict";
import test from "node:test";
import {
  PalDefenderError,
  type PalDefenderClient,
} from "../src/clients/paldefender-client.js";
import type { CredentialRepository } from "../src/repositories/credential-repository.js";
import type { ConnectionRepository } from "../src/repositories/connection-repository.js";
import { PalDefenderService } from "../src/services/paldefender-service.js";
import type { StoredConnection } from "../src/types/connections.js";
import type { PalDefenderCredentialSource } from "../src/types/credentials.js";

const connection = (id: string, token = "server-token"): StoredConnection => ({
  id,
  name: id,
  baseUrl: `http://${id}.palworld`,
  adminPassword: "admin-password",
  palDefenderEnabled: true,
  palDefenderEndpoint: `http://paldefender-${id}`,
  palDefenderToken: token,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
});

interface RecordedRequest {
  serverId: string;
  token: string;
}

function makeService(options: {
  assigned?: Map<string, string>;
  onUpstream?: (token: string) => void;
  failToken?: string;
  failError?: (token: string) => Error;
}) {
  const servers = new Map([["server-a", connection("server-a")]]);
  const repository = {
    get: async (id: string) => servers.get(id) ?? null,
  } as ConnectionRepository;
  const credentials: CredentialRepository = {
    getForUser: (_serverId, userId) => {
      const token = options.assigned?.get(userId);
      return token
        ? {
            id: `crd_${userId}`,
            serverId: "server-a",
            userId,
            token,
            createdAt: new Date(0).toISOString(),
            updatedAt: new Date(0).toISOString(),
          }
        : null;
    },
    upsert: () => {
      throw new Error("not used in this test");
    },
    removeForUser: () => undefined,
    deleteForServer: () => undefined,
    close: () => undefined,
    reopen: () => undefined,
  };
  const requests: RecordedRequest[] = [];
  const createClient = (endpoint: string, token: string): PalDefenderClient => {
    requests.push({ serverId: endpoint, token });
    options.onUpstream?.(token);
    return {
      getPlayers: async () => {
        if (options.failToken && token === options.failToken) {
          throw options.failError
            ? options.failError(token)
            : new PalDefenderError("Invalid token.", 401, "INVALID_TOKEN");
        }
        return [
          {
            name: "Player A",
            playerId: "player-1",
            online: true,
            guild: null,
            level: null,
          },
        ];
      },
    } as PalDefenderClient;
  };
  const service = new PalDefenderService(repository, createClient, credentials);
  return { service, requests, credentials };
}

test("without an actor the server default credential is selected", async () => {
  const { service, requests } = makeService({});
  await service.players("server-a");
  assert.deepEqual(requests, [
    { serverId: "http://paldefender-server-a", token: "server-token" },
  ]);
});

test("an actor without an assigned credential uses the server default and reports it", async () => {
  const { service, requests } = makeService({});
  const sources: PalDefenderCredentialSource[] = [];
  await service.players("server-a", {
    userId: "user-1",
    onCredentialSource: (source) => sources.push(source),
  });
  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.token, "server-token");
  assert.deepEqual(sources, ["server_default"]);
});

test("an assigned user credential takes precedence over the server default", async () => {
  const { service, requests } = makeService({
    assigned: new Map([["user-1", "user-token"]]),
  });
  const sources: PalDefenderCredentialSource[] = [];
  await service.players("server-a", {
    userId: "user-1",
    onCredentialSource: (source) => sources.push(source),
  });
  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.token, "user-token");
  assert.deepEqual(sources, ["user"]);
});

test("a different actor on the same server still uses the server default", async () => {
  const { service, requests } = makeService({
    assigned: new Map([["user-1", "user-token"]]),
  });
  await service.players("server-a", { userId: "user-2" });
  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.token, "server-token");
});

test("fail-closed: an invalid user credential makes exactly one request and never falls back", async () => {
  const { service, requests } = makeService({
    assigned: new Map([["user-1", "stale-user-token"]]),
    failToken: "stale-user-token",
  });
  await assert.rejects(
    service.players("server-a", { userId: "user-1" }),
    (error: unknown) =>
      error instanceof PalDefenderError &&
      error.statusCode === 401 &&
      error.code === "INVALID_TOKEN",
  );
  assert.deepEqual(
    requests,
    [
      {
        serverId: "http://paldefender-server-a",
        token: "stale-user-token",
      },
    ],
    "no retry with the server default credential is allowed",
  );
});

test("fail-closed: a permission-denied user credential surfaces the 403 reason", async () => {
  const { service, requests } = makeService({
    assigned: new Map([["user-1", "limited-user-token"]]),
    failToken: "limited-user-token",
    failError: () =>
      new PalDefenderError(
        "Missing permission 'REST.Players.Read'.",
        403,
        "MISSING_PERMISSION",
      ),
  });
  const sources: PalDefenderCredentialSource[] = [];
  await assert.rejects(
    service.players("server-a", {
      userId: "user-1",
      onCredentialSource: (source) => sources.push(source),
    }),
    (error: unknown) =>
      error instanceof PalDefenderError &&
      error.statusCode === 403 &&
      error.code === "MISSING_PERMISSION" &&
      error.message.includes("REST.Players.Read"),
  );
  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.token, "limited-user-token");
  assert.deepEqual(
    sources,
    ["user"],
    "the source is reported before the failure",
  );
});

test("status probes ignore user credentials and split 401 from 403", async () => {
  const servers = new Map<string, StoredConnection>([
    ["auth", connection("auth")],
    ["denied", connection("denied")],
  ]);
  const repository = {
    get: async (id: string) => servers.get(id) ?? null,
  } as ConnectionRepository;
  const credentials: CredentialRepository = {
    getForUser: () => ({
      id: "crd_x",
      serverId: "auth",
      userId: "user-1",
      token: "user-token",
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    }),
    upsert: () => {
      throw new Error("not used");
    },
    removeForUser: () => undefined,
    deleteForServer: () => undefined,
    close: () => undefined,
    reopen: () => undefined,
  };
  const seenTokens: string[] = [];
  const service = new PalDefenderService(
    repository,
    (_endpoint, token) => {
      seenTokens.push(token);
      return {
        getVersion: async () => {
          if (token === "server-token") {
            if (seenTokens.length === 1) {
              throw new PalDefenderError(
                "Invalid token.",
                401,
                "INVALID_TOKEN",
              );
            }
            throw new PalDefenderError(
              "Missing permission 'REST.Version.Read'.",
              403,
              "MISSING_PERMISSION",
            );
          }
          return "1.8.3";
        },
      } as PalDefenderClient;
    },
    credentials,
  );

  assert.equal((await service.status("auth")).state, "authentication_failed");
  assert.equal((await service.status("denied")).state, "permission_failed");
  assert.deepEqual(
    seenTokens,
    ["server-token", "server-token"],
    "status must never use an assigned user credential",
  );
});
