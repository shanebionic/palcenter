import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import type { FastifyInstance } from "fastify";
import { SqliteHistoryRepository } from "../src/repositories/sqlite-history-repository.js";

const directory = await fs.mkdtemp(
  path.join(os.tmpdir(), "palcenter-credential-route-"),
);
process.env.NODE_ENV = "test";
process.env.CONFIG_DIR = directory;
process.env.LOG_LEVEL = "silent";
process.env.HISTORY_INTERVAL_SECONDS = "3600";
process.env.TELEMETRY_INTERVAL_SECONDS = "3600";
process.env.PALCENTER_CORS_ORIGINS = "http://localhost:3000";

let app: FastifyInstance;
let administratorCookie = "";
let moderatorCookie = "";
const originalFetch = globalThis.fetch;
const upstreamRequests: Array<{ url: string; token: string }> = [];

function cookie(response: {
  headers: Record<string, string | string[] | undefined>;
}) {
  const value = response.headers["set-cookie"];
  assert.equal(typeof value, "string");
  return value.split(";", 1)[0];
}

function auditEntries(serverId: string) {
  const repository = new SqliteHistoryRepository(directory);
  repository.initialize();
  const entries = repository.listAudit(serverId, { limit: 100 });
  repository.close();
  return entries;
}

before(async () => {
  const now = new Date().toISOString();
  await fs.writeFile(
    path.join(directory, "servers.json"),
    JSON.stringify({
      version: 1,
      servers: [
        {
          id: "server-a",
          name: "Server A",
          baseUrl: "http://palworld-a",
          adminPassword: "admin-password",
          palDefenderEnabled: true,
          palDefenderEndpoint: "http://paldefender-a",
          palDefenderToken: "route-test-token",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "server-b",
          name: "Server B",
          baseUrl: "http://palworld-b",
          adminPassword: "admin-password",
          palDefenderEnabled: true,
          palDefenderEndpoint: "http://paldefender-b",
          palDefenderToken: "server-b-token",
          createdAt: now,
          updatedAt: now,
        },
      ],
    }),
  );
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const token =
      new Headers(init?.headers)
        .get("Authorization")
        ?.replace(/^Bearer /, "") ?? "";
    upstreamRequests.push({ url, token });
    if (url.endsWith("/version"))
      return Response.json({ Version: { Version: "1.8.3" } });
    if (token === "user-stale-token") {
      return Response.json(
        { Error: { Code: "INVALID_TOKEN", Message: "Invalid token." } },
        { status: 401 },
      );
    }
    if (token === "user-limited-token" && url.endsWith("/players")) {
      return Response.json(
        {
          Error: {
            Code: "MISSING_PERMISSION",
            Message: "Missing permission 'REST.Players.Read'.",
          },
        },
        { status: 403 },
      );
    }
    if (url.endsWith("/players")) {
      return Response.json({
        Players: [{ Name: "Player", PlayerUID: "player-1", Status: "Online" }],
      });
    }
    if (url.endsWith("/kick/player-1")) {
      return Response.json({ Success: true, UserId: "steam_private" });
    }
    throw new Error(`Unexpected request: ${url}`);
  };
  ({ app } = await import("../src/index.js"));
  await app.ready();
  const setup = await app.inject({
    method: "POST",
    url: "/api/auth/setup",
    payload: {
      username: "administrator",
      email: "administrator@example.com",
      password: "Administrator-Password-123!",
      passwordConfirmation: "Administrator-Password-123!",
    },
  });
  assert.equal(setup.statusCode, 201);
  administratorCookie = cookie(setup);

  const moderator = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: { cookie: administratorCookie },
    payload: {
      username: "moderator",
      email: "moderator@example.com",
      password: "Moderator-Password-123!",
      role: "moderator",
    },
  });
  assert.equal(moderator.statusCode, 201);
  const moderatorLogin = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: {
      username: "moderator",
      password: "Moderator-Password-123!",
    },
  });
  assert.equal(moderatorLogin.statusCode, 200);
  const temporaryCookie = cookie(moderatorLogin);
  const passwordChange = await app.inject({
    method: "POST",
    url: "/api/users/me/password",
    headers: { cookie: temporaryCookie },
    payload: {
      currentPassword: "Moderator-Password-123!",
      newPassword: "Moderator-Replacement-456!",
      passwordConfirmation: "Moderator-Replacement-456!",
    },
  });
  assert.equal(passwordChange.statusCode, 200);
  const moderatorReLogin = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: {
      username: "moderator",
      password: "Moderator-Replacement-456!",
    },
  });
  assert.equal(moderatorReLogin.statusCode, 200);
  moderatorCookie = cookie(moderatorReLogin);
});

after(async () => {
  globalThis.fetch = originalFetch;
  await app.close();
  await fs.rm(directory, { recursive: true, force: true });
});

async function userIdFor(username: string) {
  const users = (
    await app.inject({
      method: "GET",
      url: "/api/users",
      headers: { cookie: administratorCookie },
    })
  ).json().users as Array<{ id: string; username: string }>;
  return users.find((user) => user.username === username)!.id;
}

test("credential management is administrator-only", async () => {
  const asModerator = await app.inject({
    method: "GET",
    url: "/api/servers/server-a/users/paldefender-credentials",
    headers: { cookie: moderatorCookie },
  });
  assert.equal(asModerator.statusCode, 403);
  assert.equal(asModerator.json().error, "insufficient_permissions");

  const moderatorId = await userIdFor("moderator");
  const putAsModerator = await app.inject({
    method: "PUT",
    url: `/api/servers/server-a/users/${moderatorId}/paldefender-credential`,
    headers: { cookie: moderatorCookie },
    payload: { token: "not-allowed" },
  });
  assert.equal(putAsModerator.statusCode, 403);
});

test("credential endpoints require an existing server", async () => {
  const list = await app.inject({
    method: "GET",
    url: "/api/servers/missing-server/users/paldefender-credentials",
    headers: { cookie: administratorCookie },
  });
  assert.equal(list.statusCode, 404);
  assert.equal(list.json().error, "server_not_found");

  const put = await app.inject({
    method: "PUT",
    url: "/api/servers/missing-server/users/user-1/paldefender-credential",
    headers: { cookie: administratorCookie },
    payload: { token: "some-token" },
  });
  assert.equal(put.statusCode, 404);
  assert.equal(put.json().error, "server_not_found");
});

test("assign, replace, list, and revoke manage credentials write-only", async () => {
  const users = (
    await app.inject({
      method: "GET",
      url: "/api/users",
      headers: { cookie: administratorCookie },
    })
  ).json().users as Array<{ id: string; username: string }>;
  const moderatorUser = users.find((user) => user.username === "moderator")!;

  const initial = await app.inject({
    method: "GET",
    url: "/api/servers/server-a/users/paldefender-credentials",
    headers: { cookie: administratorCookie },
  });
  assert.equal(initial.statusCode, 200);
  assert.equal(
    initial
      .json()
      .credentials.find(
        (entry: { userId: string }) => entry.userId === moderatorUser.id,
      )?.configured,
    false,
  );

  const assign = await app.inject({
    method: "PUT",
    url: `/api/servers/server-a/users/${moderatorUser.id}/paldefender-credential`,
    headers: { cookie: administratorCookie },
    payload: { token: "user-good-token" },
  });
  assert.equal(assign.statusCode, 200);
  const assigned = assign.json();
  assert.equal(assigned.configured, true);
  assert.equal(assigned.username, "moderator");
  assert.equal(
    JSON.stringify(assigned).includes("user-good-token"),
    false,
    "the token must never be returned",
  );

  const blank = await app.inject({
    method: "PUT",
    url: `/api/servers/server-a/users/${moderatorUser.id}/paldefender-credential`,
    headers: { cookie: administratorCookie },
    payload: { token: "   " },
  });
  assert.equal(blank.statusCode, 400);
  assert.equal(blank.json().error, "invalid_paldefender_credential");

  const unknownUser = await app.inject({
    method: "PUT",
    url: "/api/servers/server-a/users/missing-user/paldefender-credential",
    headers: { cookie: administratorCookie },
    payload: { token: "some-token" },
  });
  assert.equal(unknownUser.statusCode, 404);
  assert.equal(unknownUser.json().error, "user_not_found");

  const replaced = await app.inject({
    method: "PUT",
    url: `/api/servers/server-a/users/${moderatorUser.id}/paldefender-credential`,
    headers: { cookie: administratorCookie },
    payload: { token: "user-stale-token" },
  });
  assert.equal(replaced.statusCode, 200);

  const listed = await app.inject({
    method: "GET",
    url: "/api/servers/server-a/users/paldefender-credentials",
    headers: { cookie: administratorCookie },
  });
  assert.equal(
    listed
      .json()
      .credentials.find(
        (entry: { userId: string }) => entry.userId === moderatorUser.id,
      )?.configured,
    true,
  );
  assert.equal(
    JSON.stringify(listed.json()).includes("user-stale-token"),
    false,
    "list must not expose token material",
  );

  const revoke = await app.inject({
    method: "DELETE",
    url: `/api/servers/server-a/users/${moderatorUser.id}/paldefender-credential`,
    headers: { cookie: administratorCookie },
  });
  assert.equal(revoke.statusCode, 204);

  const afterRevoke = await app.inject({
    method: "GET",
    url: "/api/servers/server-a/users/paldefender-credentials",
    headers: { cookie: administratorCookie },
  });
  assert.equal(
    afterRevoke
      .json()
      .credentials.find(
        (entry: { userId: string }) => entry.userId === moderatorUser.id,
      )?.configured,
    false,
  );
});

test("an assigned user credential takes precedence for that actor's requests", async () => {
  const users = (
    await app.inject({
      method: "GET",
      url: "/api/users",
      headers: { cookie: administratorCookie },
    })
  ).json().users as Array<{ id: string; username: string }>;
  const moderatorUser = users.find((user) => user.username === "moderator")!;
  await app.inject({
    method: "PUT",
    url: `/api/servers/server-a/users/${moderatorUser.id}/paldefender-credential`,
    headers: { cookie: administratorCookie },
    payload: { token: "user-good-token" },
  });

  upstreamRequests.length = 0;
  const moderatorPlayers = await app.inject({
    method: "GET",
    url: "/api/servers/server-a/paldefender/players",
    headers: { cookie: moderatorCookie },
  });
  assert.equal(moderatorPlayers.statusCode, 200);
  assert.deepEqual(
    upstreamRequests.map((request) => request.token),
    ["user-good-token"],
  );

  upstreamRequests.length = 0;
  const administratorPlayers = await app.inject({
    method: "GET",
    url: "/api/servers/server-a/paldefender/players",
    headers: { cookie: administratorCookie },
  });
  assert.equal(administratorPlayers.statusCode, 200);
  assert.deepEqual(
    upstreamRequests.map((request) => request.token),
    ["route-test-token"],
    "actors without an assigned credential keep the server default",
  );
});

test("fail-closed: an invalid user credential is reported and never retried", async () => {
  const users = (
    await app.inject({
      method: "GET",
      url: "/api/users",
      headers: { cookie: administratorCookie },
    })
  ).json().users as Array<{ id: string; username: string }>;
  const moderatorUser = users.find((user) => user.username === "moderator")!;
  await app.inject({
    method: "PUT",
    url: `/api/servers/server-a/users/${moderatorUser.id}/paldefender-credential`,
    headers: { cookie: administratorCookie },
    payload: { token: "user-stale-token" },
  });

  upstreamRequests.length = 0;
  const response = await app.inject({
    method: "GET",
    url: "/api/servers/server-a/paldefender/players",
    headers: { cookie: moderatorCookie },
  });
  assert.equal(response.statusCode, 502);
  assert.equal(response.json().error, "paldefender_credential_invalid");
  assert.deepEqual(
    upstreamRequests.map((request) => request.token),
    ["user-stale-token"],
    "exactly one upstream request; no fallback to the server default",
  );
});

test("a permission-limited user credential reports the missing permission", async () => {
  const users = (
    await app.inject({
      method: "GET",
      url: "/api/users",
      headers: { cookie: administratorCookie },
    })
  ).json().users as Array<{ id: string; username: string }>;
  const moderatorUser = users.find((user) => user.username === "moderator")!;
  await app.inject({
    method: "PUT",
    url: `/api/servers/server-a/users/${moderatorUser.id}/paldefender-credential`,
    headers: { cookie: administratorCookie },
    payload: { token: "user-limited-token" },
  });

  upstreamRequests.length = 0;
  const response = await app.inject({
    method: "GET",
    url: "/api/servers/server-a/paldefender/players",
    headers: { cookie: moderatorCookie },
  });
  assert.equal(response.statusCode, 502);
  assert.equal(response.json().error, "paldefender_permission_denied");
  assert.ok(String(response.json().message).includes("REST.Players.Read"));
  assert.deepEqual(
    upstreamRequests.map((request) => request.token),
    ["user-limited-token"],
  );
});

test("audit entries record the credential source on success and failure", async () => {
  const users = (
    await app.inject({
      method: "GET",
      url: "/api/users",
      headers: { cookie: administratorCookie },
    })
  ).json().users as Array<{ id: string; username: string }>;
  const moderatorUser = users.find((user) => user.username === "moderator")!;

  await app.inject({
    method: "PUT",
    url: `/api/servers/server-a/users/${moderatorUser.id}/paldefender-credential`,
    headers: { cookie: administratorCookie },
    payload: { token: "user-good-token" },
  });

  const moderatorKick = await app.inject({
    method: "POST",
    url: "/api/servers/server-a/paldefender/players/player-1/kick",
    headers: { cookie: moderatorCookie },
    payload: {},
  });
  assert.equal(moderatorKick.statusCode, 200);

  const administratorKick = await app.inject({
    method: "POST",
    url: "/api/servers/server-a/paldefender/players/player-1/kick",
    headers: { cookie: administratorCookie },
    payload: {},
  });
  assert.equal(administratorKick.statusCode, 200);

  await app.inject({
    method: "PUT",
    url: `/api/servers/server-a/users/${moderatorUser.id}/paldefender-credential`,
    headers: { cookie: administratorCookie },
    payload: { token: "user-stale-token" },
  });
  const failedKick = await app.inject({
    method: "POST",
    url: "/api/servers/server-a/paldefender/players/player-1/kick",
    headers: { cookie: moderatorCookie },
    payload: {},
  });
  assert.equal(failedKick.statusCode, 502);

  const kicks = auditEntries("server-a").filter(
    (entry) => entry.action === "kick_player",
  );
  assert.equal(kicks.length, 3);
  const moderatorSuccess = kicks.find(
    (entry) =>
      entry.actorUsername === "moderator" && entry.result === "success",
  );
  assert.ok(moderatorSuccess);
  assert.equal(moderatorSuccess.details.palDefenderCredentialSource, "user");
  const administratorAudit = kicks.find(
    (entry) => entry.actorUsername === "administrator",
  );
  assert.ok(administratorAudit);
  assert.equal(administratorAudit.result, "success");
  assert.equal(
    administratorAudit.details.palDefenderCredentialSource,
    "server_default",
  );
  const moderatorFailure = kicks.find(
    (entry) => entry.actorUsername === "moderator" && entry.result === "failed",
  );
  assert.ok(moderatorFailure);
  assert.equal(moderatorFailure.details.palDefenderCredentialSource, "user");
});

test("deleting a user removes their credential rows", async () => {
  const created = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: { cookie: administratorCookie },
    payload: {
      username: "temp-visitor",
      email: "temp-visitor@example.com",
      password: "Temporary-Password-123!",
      role: "visitor",
    },
  });
  assert.equal(created.statusCode, 201);
  const tempUser = created.json() as { id: string };
  await app.inject({
    method: "PUT",
    url: `/api/servers/server-a/users/${tempUser.id}/paldefender-credential`,
    headers: { cookie: administratorCookie },
    payload: { token: "temp-token" },
  });

  const removed = await app.inject({
    method: "DELETE",
    url: `/api/users/${tempUser.id}`,
    headers: { cookie: administratorCookie },
  });
  assert.equal(removed.statusCode, 204);

  const probe = new DatabaseSync(path.join(directory, "users.sqlite"));
  const rows = probe
    .prepare(
      "SELECT COUNT(*) AS count FROM paldefender_user_credentials WHERE user_id = ?",
    )
    .get(tempUser.id) as { count: number };
  probe.close();
  assert.equal(rows.count, 0);
});

test("deleting a server removes its credential rows", async () => {
  const users = (
    await app.inject({
      method: "GET",
      url: "/api/users",
      headers: { cookie: administratorCookie },
    })
  ).json().users as Array<{ id: string; username: string }>;
  const moderatorUser = users.find((user) => user.username === "moderator")!;
  await app.inject({
    method: "PUT",
    url: `/api/servers/server-b/users/${moderatorUser.id}/paldefender-credential`,
    headers: { cookie: administratorCookie },
    payload: { token: "server-b-user-token" },
  });

  const removed = await app.inject({
    method: "DELETE",
    url: "/api/servers/server-b",
    headers: { cookie: administratorCookie },
  });
  assert.equal(removed.statusCode, 204);

  const probe = new DatabaseSync(path.join(directory, "users.sqlite"));
  const rows = probe
    .prepare(
      "SELECT COUNT(*) AS count FROM paldefender_user_credentials WHERE server_id = 'server-b'",
    )
    .get() as { count: number };
  probe.close();
  assert.equal(rows.count, 0);

  const list = await app.inject({
    method: "GET",
    url: "/api/servers/server-b/users/paldefender-credentials",
    headers: { cookie: administratorCookie },
  });
  assert.equal(list.statusCode, 404);
  assert.equal(list.json().error, "server_not_found");
});
