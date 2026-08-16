import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { SqliteCredentialRepository } from "../src/repositories/sqlite-credential-repository.js";
import { SqliteUserRepository } from "../src/repositories/sqlite-user-repository.js";
import {
  CredentialManager,
  CredentialTokenError,
} from "../src/services/credential-manager.js";
import { UserNotFoundError } from "../src/services/user-service.js";

async function fixture() {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "palcenter-credential-manager-"),
  );
  const users = new SqliteUserRepository(directory);
  users.initialize();
  const credentials = new SqliteCredentialRepository(directory);
  const manager = new CredentialManager(credentials, users);
  return { directory, users, credentials, manager };
}

const newUser = (id: string, username: string) => ({
  id,
  username,
  email: `${username}@example.com`,
  passwordHash: "hash",
  role: "visitor" as const,
  enabled: true,
  mustChangePassword: false,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
});

test("assign stores a trimmed credential and reports the user identity", async () => {
  const context = await fixture();
  try {
    const user = context.users.create(newUser("user-1", "player-one"));
    const result = context.manager.assign(
      "server-a",
      user.id,
      "  padded-token  ",
    );
    assert.equal(result.userId, user.id);
    assert.equal(result.username, "player-one");
    assert.equal(result.configured, true);
    assert.ok(result.updatedAt);
    assert.equal(
      context.credentials.getForUser("server-a", user.id)?.token,
      "padded-token",
    );
  } finally {
    context.credentials.close();
    context.users.close();
    await fs.rm(context.directory, { recursive: true, force: true });
  }
});

test("replace updates the stored token for the same (server, user)", async () => {
  const context = await fixture();
  try {
    const user = context.users.create(newUser("user-1", "player-one"));
    context.manager.assign("server-a", user.id, "token-one");
    context.manager.assign("server-a", user.id, "token-two");
    assert.equal(
      context.credentials.getForUser("server-a", user.id)?.token,
      "token-two",
    );
  } finally {
    context.credentials.close();
    context.users.close();
    await fs.rm(context.directory, { recursive: true, force: true });
  }
});

test("blank and oversized tokens are rejected without writing", async () => {
  const context = await fixture();
  try {
    const user = context.users.create(newUser("user-1", "player-one"));
    for (const token of ["", "   ", "t".repeat(2_049)]) {
      assert.throws(
        () => context.manager.assign("server-a", user.id, token),
        CredentialTokenError,
      );
    }
    assert.equal(context.credentials.getForUser("server-a", user.id), null);
  } finally {
    context.credentials.close();
    context.users.close();
    await fs.rm(context.directory, { recursive: true, force: true });
  }
});

test("assign and revoke for an unknown user fail with user_not_found semantics", async () => {
  const context = await fixture();
  try {
    assert.throws(
      () => context.manager.assign("server-a", "missing", "token"),
      UserNotFoundError,
    );
    assert.throws(
      () => context.manager.revoke("server-a", "missing"),
      UserNotFoundError,
    );
  } finally {
    context.credentials.close();
    context.users.close();
    await fs.rm(context.directory, { recursive: true, force: true });
  }
});

test("revoke clears the credential for that (server, user) only", async () => {
  const context = await fixture();
  try {
    const user = context.users.create(newUser("user-1", "player-one"));
    context.manager.assign("server-a", user.id, "token-a");
    context.manager.assign("server-b", user.id, "token-b");
    context.manager.revoke("server-a", user.id);
    assert.equal(context.credentials.getForUser("server-a", user.id), null);
    assert.equal(
      context.credentials.getForUser("server-b", user.id)?.token,
      "token-b",
    );
  } finally {
    context.credentials.close();
    context.users.close();
    await fs.rm(context.directory, { recursive: true, force: true });
  }
});

test("list reports configuration state without exposing token material", async () => {
  const context = await fixture();
  try {
    const configured = context.users.create(newUser("user-1", "alpha"));
    const unconfigured = context.users.create(newUser("user-2", "beta"));
    context.manager.assign("server-a", configured.id, "secret-token");

    const list = context.manager.listForServer("server-a");
    assert.deepEqual(
      list.map((entry) => [entry.username, entry.configured]),
      [
        ["alpha", true],
        ["beta", false],
      ],
    );
    assert.equal(list[0]?.role, "visitor");
    assert.ok(list[0]?.updatedAt);
    assert.equal(list[1]?.updatedAt, null);
    const serialized = JSON.stringify(list);
    assert.equal(serialized.includes("secret-token"), false);
  } finally {
    context.credentials.close();
    context.users.close();
    await fs.rm(context.directory, { recursive: true, force: true });
  }
});
