import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import type { FastifyInstance } from "fastify";
import { JsonConnectionRepository } from "../src/repositories/json-connection-repository.js";
import type { StoredConnection } from "../src/types/connections.js";

const directory = await fs.mkdtemp(
  path.join(os.tmpdir(), "palcenter-remove-route-"),
);

process.env.NODE_ENV = "test";
process.env.CONFIG_DIR = directory;
process.env.LOG_LEVEL = "silent";
process.env.HISTORY_INTERVAL_SECONDS = "3600";
process.env.PALCENTER_SESSION_COOKIE_SECURE = "false";

let app: FastifyInstance;
let administratorCookie: string;
let moderatorCookie: string;
let visitorCookie: string;
let remoteRequests = 0;
const originalFetch = globalThis.fetch;

function connection(id: string): StoredConnection {
  const timestamp = "2026-07-27T12:00:00.000Z";

  return {
    id,
    name: id,
    baseUrl: "http://127.0.0.1:1",
    adminPassword: "must-not-be-used",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function cookie(response: {
  headers: Record<string, string | string[] | undefined>;
}): string {
  const header = response.headers["set-cookie"];
  assert.equal(typeof header, "string");
  return header.split(";", 1)[0];
}

async function login(username: string, password: string): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { username, password },
  });
  assert.equal(response.statusCode, 200);
  return cookie(response);
}

async function createUser(
  username: string,
  role: "moderator" | "visitor",
): Promise<string> {
  const temporaryPassword = `Temporary-${username}-123!`;
  const replacementPassword = `Replacement-${username}-456!`;
  const createResponse = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: { cookie: administratorCookie },
    payload: {
      username,
      email: `${username}@example.com`,
      password: temporaryPassword,
      role,
    },
  });
  assert.equal(createResponse.statusCode, 201);

  const temporaryCookie = await login(username, temporaryPassword);
  const passwordResponse = await app.inject({
    method: "POST",
    url: "/api/users/me/password",
    headers: { cookie: temporaryCookie },
    payload: {
      currentPassword: temporaryPassword,
      newPassword: replacementPassword,
      passwordConfirmation: replacementPassword,
    },
  });
  assert.equal(passwordResponse.statusCode, 200);

  return login(username, replacementPassword);
}

before(async () => {
  globalThis.fetch = async () => {
    remoteRequests += 1;
    throw new Error("A server-removal route must not make a remote request.");
  };

  ({ app } = await import("../src/index.js"));
  await app.ready();

  const setupResponse = await app.inject({
    method: "POST",
    url: "/api/auth/setup",
    payload: {
      username: "administrator",
      email: "administrator@example.com",
      password: "Administrator-Password-123!",
      passwordConfirmation: "Administrator-Password-123!",
    },
  });
  assert.equal(setupResponse.statusCode, 201);
  administratorCookie = cookie(setupResponse);
  moderatorCookie = await createUser("moderator", "moderator");
  visitorCookie = await createUser("visitor", "visitor");

  const connections = new JsonConnectionRepository(directory);
  for (const id of ["srv_administrator", "srv_moderator", "srv_visitor"]) {
    await connections.create(connection(id));
  }
});

after(async () => {
  globalThis.fetch = originalFetch;
  await app.close();
  await fs.rm(directory, { recursive: true, force: true });
});

test("Administrator deleting an existing server returns 204 without a remote request", async () => {
  const response = await app.inject({
    method: "DELETE",
    url: "/api/servers/srv_administrator",
    headers: { cookie: administratorCookie },
  });

  assert.equal(response.statusCode, 204);
  assert.equal(remoteRequests, 0);
});

test("Moderator deleting an existing server returns 403", async () => {
  const response = await app.inject({
    method: "DELETE",
    url: "/api/servers/srv_moderator",
    headers: { cookie: moderatorCookie },
  });

  assert.equal(response.statusCode, 403);
  assert.equal(response.json().error, "insufficient_permissions");
  assert.ok(await new JsonConnectionRepository(directory).get("srv_moderator"));
});

test("Visitor deleting an existing server returns 403", async () => {
  const response = await app.inject({
    method: "DELETE",
    url: "/api/servers/srv_visitor",
    headers: { cookie: visitorCookie },
  });

  assert.equal(response.statusCode, 403);
  assert.equal(response.json().error, "insufficient_permissions");
  assert.ok(await new JsonConnectionRepository(directory).get("srv_visitor"));
});

test("Administrator deleting an unknown server returns server_not_found", async () => {
  const response = await app.inject({
    method: "DELETE",
    url: "/api/servers/srv_unknown",
    headers: { cookie: administratorCookie },
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error, "server_not_found");
  assert.equal(remoteRequests, 0);
});

test("only Administrators can update saved server connections", async () => {
  await new JsonConnectionRepository(directory).create(connection("srv_edit"));
  const administratorResponse = await app.inject({
    method: "PUT",
    url: "/api/servers/srv_edit",
    headers: { cookie: administratorCookie },
    payload: {
      name: "Updated Administrator Server",
      baseUrl: "https://updated.example:9443",
      adminPassword: "",
    },
  });
  assert.equal(administratorResponse.statusCode, 200);
  assert.equal(administratorResponse.json().id, "srv_edit");
  assert.equal("adminPassword" in administratorResponse.json(), false);
  const stored = await new JsonConnectionRepository(directory).get("srv_edit");
  assert.equal(stored?.adminPassword, "must-not-be-used");

  for (const [id, roleCookie] of [
    ["srv_moderator", moderatorCookie],
    ["srv_visitor", visitorCookie],
  ] as const) {
    const response = await app.inject({
      method: "PUT",
      url: `/api/servers/${id}`,
      headers: { cookie: roleCookie },
      payload: {
        name: "Forbidden Update",
        baseUrl: "https://forbidden.example:9443",
        adminPassword: "",
      },
    });
    assert.equal(response.statusCode, 403);
    assert.equal(response.json().error, "insufficient_permissions");
    assert.equal(
      (await new JsonConnectionRepository(directory).get(id))?.name,
      id,
    );
  }
});

test("automation routes allow all roles to view but only Administrators to mutate", async () => {
  const payload = {
    name: "Route authorization test",
    serverId: "srv_moderator",
    enabled: true,
    taskType: "broadcast_message",
    schedule: { type: "daily", time: "09:00" },
    timeZone: "UTC",
    configuration: { message: "Scheduled test message" },
  };
  const createResponse = await app.inject({
    method: "POST",
    url: "/api/automations",
    headers: { cookie: administratorCookie },
    payload,
  });
  assert.equal(createResponse.statusCode, 201);
  const taskId = createResponse.json().id as string;

  for (const roleCookie of [moderatorCookie, visitorCookie]) {
    const listResponse = await app.inject({
      method: "GET",
      url: "/api/automations",
      headers: { cookie: roleCookie },
    });
    assert.equal(listResponse.statusCode, 200);
    assert.equal(listResponse.json().tasks.length, 1);
    const historyResponse = await app.inject({
      method: "GET",
      url: `/api/automations/${taskId}/history`,
      headers: { cookie: roleCookie },
    });
    assert.equal(historyResponse.statusCode, 200);
    assert.deepEqual(historyResponse.json().executions, []);

    const forbiddenResponse = await app.inject({
      method: "POST",
      url: "/api/automations",
      headers: { cookie: roleCookie },
      payload: { ...payload, name: "Forbidden task" },
    });
    assert.equal(forbiddenResponse.statusCode, 403);
    assert.equal(forbiddenResponse.json().error, "insufficient_permissions");
  }
  assert.equal(remoteRequests, 0);
});
