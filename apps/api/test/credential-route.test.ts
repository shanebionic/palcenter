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

function credentialRow(serverId: string, userId: string) {
  const probe = new DatabaseSync(path.join(directory, "users.sqlite"));
  try {
    return probe
      .prepare(
        "SELECT token, updated_at FROM paldefender_user_credentials WHERE server_id = ? AND user_id = ?",
      )
      .get(serverId, userId) as
      | { token: string; updated_at: string }
      | undefined;
  } finally {
    probe.close();
  }
}

test("generate is administrator-only", async () => {
  const moderatorId = await userIdFor("moderator");
  const response = await app.inject({
    method: "POST",
    url: `/api/servers/server-a/users/${moderatorId}/paldefender-credential/generate`,
    headers: { cookie: moderatorCookie },
    payload: { assign: false },
  });
  assert.equal(response.statusCode, 403);
  assert.equal(response.json().error, "insufficient_permissions");
});

test("generate requires an existing server and user", async () => {
  const moderatorId = await userIdFor("moderator");
  const missingServer = await app.inject({
    method: "POST",
    url: `/api/servers/missing-server/users/${moderatorId}/paldefender-credential/generate`,
    headers: { cookie: administratorCookie },
    payload: { assign: false },
  });
  assert.equal(missingServer.statusCode, 404);
  assert.equal(missingServer.json().error, "server_not_found");

  const missingUser = await app.inject({
    method: "POST",
    url: "/api/servers/server-a/users/missing-user/paldefender-credential/generate",
    headers: { cookie: administratorCookie },
    payload: { assign: false },
  });
  assert.equal(missingUser.statusCode, 404);
  assert.equal(missingUser.json().error, "user_not_found");
});

test("generate returns a one-time artifact without a bare token field", async () => {
  const moderatorId = await userIdFor("moderator");
  const response = await app.inject({
    method: "POST",
    url: `/api/servers/server-a/users/${moderatorId}/paldefender-credential/generate`,
    headers: { cookie: administratorCookie },
    payload: { assign: false },
  });
  assert.equal(response.statusCode, 200);
  const body = response.json() as Record<string, unknown>;
  assert.ok(Array.isArray(body.permissions));
  assert.equal(body.assigned, false);
  assert.equal(body.stored, null);
  assert.ok("fileContent" in body);
  assert.ok(
    typeof body.name === "string" &&
      typeof body.fileName === "string" &&
      typeof body.fileContent === "string",
  );

  // The response must not duplicate the bearer token into a separate field.
  assert.ok(!("token" in body), "no separate token field");
  assert.equal(body.fileName, `PalCenter-${moderatorId}.json`);
  assert.match(body.name as string, /^PalCenter-moderator-[0-9A-F]{8}$/);
  assert.equal((body.permissions as string[]).length, 29);
  assert.ok(!(body.permissions as string[]).includes("REST.*"));
  assert.ok(!(body.permissions as string[]).includes("REST.Version.Read"));

  const parsed = JSON.parse(body.fileContent as string) as Record<
    string,
    unknown
  >;
  assert.deepEqual(Object.keys(parsed), ["Name", "Token", "Permissions"]);
  const token = parsed.Token as string;
  assert.match(token, /^[0-9a-f]{64}$/);
  assert.deepEqual(
    parsed.Permissions,
    [...(body.permissions as string[])].sort(),
  );
  // The one-time secret appears exactly once in the whole response.
  assert.equal(
    response.payload.split(token).length - 1,
    1,
    "the token appears exactly once, in the artifact",
  );
  // The one-time secret response must not be cacheable.
  assert.equal(response.headers["cache-control"], "no-store");
});

test("generate without assign stores no credential", async () => {
  const created = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: { cookie: administratorCookie },
    payload: {
      username: "gen-noassign",
      email: "gen-noassign@example.com",
      password: "Generate-Password-123!",
      role: "visitor",
    },
  });
  assert.equal(created.statusCode, 201);
  const user = created.json() as { id: string };
  const response = await app.inject({
    method: "POST",
    url: `/api/servers/server-a/users/${user.id}/paldefender-credential/generate`,
    headers: { cookie: administratorCookie },
    payload: { assign: false },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().assigned, false);
  assert.equal(credentialRow("server-a", user.id), undefined);
});

test("generate with assign stores the token server-side and rotates it on regeneration", async () => {
  const created = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: { cookie: administratorCookie },
    payload: {
      username: "gen-mod",
      email: "gen-mod@example.com",
      password: "Generate-Password-123!",
      role: "moderator",
    },
  });
  assert.equal(created.statusCode, 201);
  const user = created.json() as { id: string };

  const first = await app.inject({
    method: "POST",
    url: `/api/servers/server-a/users/${user.id}/paldefender-credential/generate`,
    headers: { cookie: administratorCookie },
    payload: { assign: true },
  });
  assert.equal(first.statusCode, 200);
  const firstBody = first.json() as {
    fileName: string;
    assigned: boolean;
    stored: { configured: boolean; updatedAt: string } | null;
  };
  assert.equal(firstBody.assigned, true);
  assert.ok(firstBody.stored?.configured === true);
  const firstToken = credentialRow("server-a", user.id)?.token;
  assert.ok(firstToken && /^[0-9a-f]{64}$/.test(firstToken));
  assert.equal(firstBody.fileName, `PalCenter-${user.id}.json`);

  // Subsequent PalDefender operations for this user use the stored token.
  upstreamRequests.length = 0;
  const firstLogin = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { username: "gen-mod", password: "Generate-Password-123!" },
  });
  assert.equal(firstLogin.statusCode, 200);
  const temporaryGenCookie = cookie(firstLogin);
  const genPasswordChange = await app.inject({
    method: "POST",
    url: "/api/users/me/password",
    headers: { cookie: temporaryGenCookie },
    payload: {
      currentPassword: "Generate-Password-123!",
      newPassword: "Generate-Replacement-456!",
      passwordConfirmation: "Generate-Replacement-456!",
    },
  });
  assert.equal(genPasswordChange.statusCode, 200);
  const genModRelogin = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { username: "gen-mod", password: "Generate-Replacement-456!" },
  });
  assert.equal(genModRelogin.statusCode, 200);
  const genModCookie = cookie(genModRelogin);
  const firstKick = await app.inject({
    method: "POST",
    url: "/api/servers/server-a/paldefender/players/player-1/kick",
    headers: { cookie: genModCookie },
    payload: {},
  });
  assert.equal(firstKick.statusCode, 200);
  assert.equal(
    upstreamRequests[upstreamRequests.length - 1]?.token,
    firstToken,
  );

  // Role downgrade: same file name, rotated token, exactly the visitor profile.
  const downgrade = await app.inject({
    method: "PATCH",
    url: `/api/users/${user.id}`,
    headers: { cookie: administratorCookie },
    payload: {
      username: "gen-mod",
      email: "gen-mod@example.com",
      role: "visitor",
      enabled: true,
    },
  });
  assert.equal(downgrade.statusCode, 200);
  const regenerated = await app.inject({
    method: "POST",
    url: `/api/servers/server-a/users/${user.id}/paldefender-credential/generate`,
    headers: { cookie: administratorCookie },
    payload: { assign: true },
  });
  assert.equal(regenerated.statusCode, 200);
  const secondBody = regenerated.json() as {
    fileName: string;
    permissions: string[];
    fileContent: string;
  };
  assert.equal(secondBody.fileName, firstBody.fileName);
  assert.equal((secondBody.permissions as string[]).length, 9);
  const secondToken = credentialRow("server-a", user.id)?.token;
  assert.ok(
    secondToken && secondToken !== firstToken,
    "regeneration must rotate the stored token",
  );
  const parsed = JSON.parse(secondBody.fileContent) as { Token: string };
  assert.equal(parsed.Token, secondToken);

  // Role changes invalidate that user's sessions, so the downgraded user
  // cannot kick from their own PalCenter identity at all.
  upstreamRequests.length = 0;
  const secondKick = await app.inject({
    method: "POST",
    url: "/api/servers/server-a/paldefender/players/player-1/kick",
    headers: { cookie: genModCookie },
    payload: {},
  });
  assert.equal(secondKick.statusCode, 401);
  assert.equal(secondKick.json().error, "authentication_required");
  assert.equal(
    upstreamRequests.length,
    0,
    "no upstream request after downgrade",
  );
});

test("generate writes an audit entry without secret material", async () => {
  const moderatorId = await userIdFor("moderator");
  // Earlier access attempts (403/404 before the route runs) also record
  // generate entries without a resolved role, so target the exact new row.
  const earlier = auditEntries("server-a").filter(
    (entry) => entry.action === "generate_paldefender_credential",
  );
  const maxId = earlier.reduce((max, entry) => Math.max(max, entry.id), 0);
  const response = await app.inject({
    method: "POST",
    url: `/api/servers/server-a/users/${moderatorId}/paldefender-credential/generate`,
    headers: { cookie: administratorCookie },
    payload: { assign: false },
  });
  assert.equal(response.statusCode, 200);
  const fileContent = response.json().fileContent as string;
  const tokenMatch = fileContent.match(/"Token": "([0-9a-f]{64})"/);
  assert.ok(tokenMatch);

  const entries = auditEntries("server-a").filter(
    (entry) =>
      entry.action === "generate_paldefender_credential" && entry.id > maxId,
  );
  assert.equal(entries.length, 1);
  const entry = entries[0];
  assert.equal(entry.category, "server");
  assert.equal(entry.targetId, moderatorId);
  assert.equal(entry.targetType, "user");
  assert.equal(entry.details.role, "moderator");
  assert.equal(entry.details.assigned, false);
  const detailsJson = JSON.stringify(entry.details);
  assert.ok(!detailsJson.includes(tokenMatch[1]));
  assert.ok(!detailsJson.includes(fileContent));
  assert.ok(!detailsJson.includes("fileContent"));
  assert.ok(!detailsJson.includes("fileName"));
});
