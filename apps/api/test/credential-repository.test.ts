import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { SqliteCredentialRepository } from "../src/repositories/sqlite-credential-repository.js";
import { SqliteUserRepository } from "../src/repositories/sqlite-user-repository.js";

async function fixture() {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "palcenter-credentials-"),
  );
  const users = new SqliteUserRepository(directory);
  users.initialize();
  const credentials = new SqliteCredentialRepository(directory);
  return { directory, users, credentials };
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

test("fresh users.sqlite initializes at schema version 2 with the credential table", async () => {
  const context = await fixture();
  try {
    const database = new DatabaseSync(
      path.join(context.directory, "users.sqlite"),
    );
    const userVersion = (
      database.prepare("PRAGMA user_version").get() as {
        user_version: number;
      }
    ).user_version;
    assert.equal(userVersion, 2);
    const table = database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'paldefender_user_credentials'",
      )
      .get() as { name: string } | undefined;
    assert.ok(table);
    database.close();
  } finally {
    context.credentials.close();
    context.users.close();
    await fs.rm(context.directory, { recursive: true, force: true });
  }
});

test("upsert stores, replaces, and reads credentials per (server, user)", async () => {
  const context = await fixture();
  try {
    const user = context.users.create(newUser("user-1", "player-one"));
    const now = new Date().toISOString();
    const saved = context.credentials.upsert(
      "server-a",
      user.id,
      "token-one",
      "crd_1",
      now,
    );
    assert.equal(saved.token, "token-one");
    assert.equal(saved.serverId, "server-a");

    const replaced = context.credentials.upsert(
      "server-a",
      user.id,
      "token-two",
      "crd_1",
      now,
    );
    assert.equal(replaced.token, "token-two");

    assert.equal(
      context.credentials.getForUser("server-a", user.id)?.token,
      "token-two",
    );
    assert.equal(context.credentials.getForUser("server-b", user.id), null);

    const probe = new DatabaseSync(
      path.join(context.directory, "users.sqlite"),
    );
    const userCount = probe
      .prepare(
        "SELECT COUNT(*) AS count FROM paldefender_user_credentials WHERE server_id = 'server-a' AND user_id = ?",
      )
      .get(user.id) as { count: number };
    probe.close();
    assert.equal(userCount.count, 1, "replace must not duplicate the row");
  } finally {
    context.credentials.close();
    context.users.close();
    await fs.rm(context.directory, { recursive: true, force: true });
  }
});

test("deleting a user cascades to their credential rows", async () => {
  const context = await fixture();
  try {
    const user = context.users.create(newUser("user-1", "player-one"));
    context.credentials.upsert(
      "server-a",
      user.id,
      "token-one",
      "crd_1",
      new Date().toISOString(),
    );
    context.users.delete(user.id);
    assert.equal(context.credentials.getForUser("server-a", user.id), null);
  } finally {
    context.credentials.close();
    context.users.close();
    await fs.rm(context.directory, { recursive: true, force: true });
  }
});

test("upsert for an unknown user reports the missing user", async () => {
  const context = await fixture();
  try {
    assert.throws(
      () =>
        context.credentials.upsert(
          "server-a",
          "missing-user",
          "token",
          "crd_1",
          new Date().toISOString(),
        ),
      (error: unknown) =>
        error instanceof Error && /User not found/.test(error.message),
    );
  } finally {
    context.credentials.close();
    context.users.close();
    await fs.rm(context.directory, { recursive: true, force: true });
  }
});

test("deleteForServer removes every credential for that server only", async () => {
  const context = await fixture();
  try {
    const one = context.users.create(newUser("user-1", "player-one"));
    const two = context.users.create(newUser("user-2", "player-two"));
    const now = new Date().toISOString();
    context.credentials.upsert("server-a", one.id, "token-a-1", "crd_1", now);
    context.credentials.upsert("server-a", two.id, "token-a-2", "crd_2", now);
    context.credentials.upsert("server-b", one.id, "token-b-1", "crd_3", now);

    context.credentials.deleteForServer("server-a");
    assert.equal(context.credentials.getForUser("server-a", one.id), null);
    assert.equal(context.credentials.getForUser("server-a", two.id), null);
    assert.equal(
      context.credentials.getForUser("server-b", one.id)?.token,
      "token-b-1",
    );
  } finally {
    context.credentials.close();
    context.users.close();
    await fs.rm(context.directory, { recursive: true, force: true });
  }
});

test("removeForUser clears a single (server, user) credential", async () => {
  const context = await fixture();
  try {
    const user = context.users.create(newUser("user-1", "player-one"));
    const now = new Date().toISOString();
    context.credentials.upsert("server-a", user.id, "token-a", "crd_1", now);
    context.credentials.upsert("server-b", user.id, "token-b", "crd_2", now);

    context.credentials.removeForUser("server-a", user.id);
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

test("schema version 1 users.sqlite migrates to version 2 in place", async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "palcenter-credentials-v1-"),
  );
  try {
    const database = new DatabaseSync(path.join(directory, "users.sqlite"));
    database.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL COLLATE NOCASE UNIQUE,
        email TEXT NOT NULL COLLATE NOCASE UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('administrator', 'moderator', 'visitor')),
        enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
        must_change_password INTEGER NOT NULL CHECK (must_change_password IN (0, 1)),
        session_version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_login_at TEXT
      );
      CREATE TABLE authentication_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      PRAGMA user_version = 1;
    `);
    database
      .prepare(
        `INSERT INTO users (
          id, username, email, password_hash, role, enabled,
          must_change_password, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'administrator', 1, 0, ?, ?)`,
      )
      .run(
        "legacy-user",
        "legacy",
        "legacy@example.com",
        "hash",
        new Date(0).toISOString(),
        new Date(0).toISOString(),
      );
    database.close();

    const users = new SqliteUserRepository(directory);
    users.initialize();
    const credentials = new SqliteCredentialRepository(directory);

    const user = users.get("legacy-user");
    assert.ok(user, "legacy user must survive the migration");

    const saved = credentials.upsert(
      "server-a",
      "legacy-user",
      "token",
      "crd_1",
      new Date().toISOString(),
    );
    assert.equal(saved.token, "token");

    const reopened = new DatabaseSync(path.join(directory, "users.sqlite"));
    const userVersion = (
      reopened.prepare("PRAGMA user_version").get() as {
        user_version: number;
      }
    ).user_version;
    assert.equal(userVersion, 2);
    reopened.close();

    credentials.close();
    users.close();
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("a newer schema version is refused instead of downgraded", async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "palcenter-credentials-newer-"),
  );
  try {
    const database = new DatabaseSync(path.join(directory, "users.sqlite"));
    database.exec("PRAGMA user_version = 99;");
    database.close();

    const users = new SqliteUserRepository(directory);
    assert.throws(
      () => users.initialize(),
      (error: unknown) =>
        error instanceof Error && /schema version 99/.test(error.message),
    );
    users.close();
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
