import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { SqliteUserRepository } from "../src/repositories/sqlite-user-repository.js";
import { AuthenticationService } from "../src/services/authentication-service.js";
import { AuthorizationService } from "../src/services/authorization-service.js";
import { PasswordService } from "../src/services/password-service.js";
import {
  SetupUnavailableError,
  UserSafetyError,
  UserService,
} from "../src/services/user-service.js";

async function fixture() {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "palcenter-users-"),
  );
  const repository = new SqliteUserRepository(directory);
  repository.initialize();
  const passwords = new PasswordService();
  const users = new UserService(repository, passwords);
  const authentication = new AuthenticationService(
    {
      sessionSecret: "12345678901234567890123456789012",
      sessionDurationSeconds: 3600,
      secureCookie: false,
    },
    repository,
    passwords,
  );
  return { directory, repository, users, authentication };
}

test("first-run setup is single-use and creates an Administrator", async () => {
  const context = await fixture();
  try {
    assert.equal(context.users.setupRequired(), true);
    const administrator = await context.users.setup({
      username: "owner",
      email: "owner@example.com",
      password: "Strong-Password-123!",
    });
    assert.equal(administrator.role, "administrator");
    assert.equal(administrator.enabled, true);
    assert.equal(context.users.setupRequired(), false);
    await assert.rejects(
      context.users.setup({
        username: "second",
        email: "second@example.com",
        password: "Strong-Password-123!",
      }),
      SetupUnavailableError,
    );
  } finally {
    context.repository.close();
    await fs.rm(context.directory, { recursive: true, force: true });
  }
});

test("login, password changes, and session invalidation use stored users", async () => {
  const context = await fixture();
  try {
    const user = await context.users.setup({
      username: "owner",
      email: "owner@example.com",
      password: "Strong-Password-123!",
    });
    const login = await context.authentication.login(
      "OWNER",
      "Strong-Password-123!",
      "127.0.0.1",
    );
    assert.ok(login);
    const cookie = context.authentication.sessionCookie(login.token);
    assert.equal(
      context.authentication.sessionFromCookie(cookie)?.user.id,
      user.id,
    );

    await context.users.changePassword(
      user.id,
      "Strong-Password-123!",
      "Replacement-Password-456!",
    );
    assert.equal(context.authentication.sessionFromCookie(cookie), null);
    assert.equal(
      await context.authentication.login(
        "owner",
        "Strong-Password-123!",
        "127.0.0.2",
      ),
      null,
    );
    assert.ok(
      await context.authentication.login(
        "owner",
        "Replacement-Password-456!",
        "127.0.0.3",
      ),
    );
  } finally {
    context.repository.close();
    await fs.rm(context.directory, { recursive: true, force: true });
  }
});

test("roles invalidate sessions and protect the last enabled Administrator", async () => {
  const context = await fixture();
  try {
    const administrator = await context.users.setup({
      username: "owner",
      email: "owner@example.com",
      password: "Strong-Password-123!",
    });
    const moderator = await context.users.create({
      username: "moderator",
      email: "moderator@example.com",
      password: "Temporary-Password-123!",
      role: "moderator",
    });
    assert.equal(moderator.mustChangePassword, true);
    const login = await context.authentication.login(
      "moderator",
      "Temporary-Password-123!",
      "10.0.0.1",
    );
    assert.ok(login);
    const cookie = context.authentication.sessionCookie(login.token);
    context.users.update(moderator.id, {
      username: moderator.username,
      email: moderator.email,
      role: "visitor",
      enabled: true,
    });
    assert.equal(context.authentication.sessionFromCookie(cookie), null);

    assert.throws(
      () =>
        context.users.update(administrator.id, {
          username: administrator.username,
          email: administrator.email,
          role: "visitor",
          enabled: true,
        }),
      UserSafetyError,
    );
    assert.throws(
      () => context.users.delete(administrator.id),
      UserSafetyError,
    );
  } finally {
    context.repository.close();
    await fs.rm(context.directory, { recursive: true, force: true });
  }
});

test("central role permissions enforce administrator, moderator, and visitor scope", () => {
  const authorization = new AuthorizationService();
  assert.equal(authorization.can("administrator", "manage_users"), true);
  assert.equal(authorization.can("moderator", "operate"), true);
  assert.equal(authorization.can("moderator", "manage_backups"), false);
  assert.equal(authorization.can("visitor", "read"), true);
  assert.equal(authorization.can("visitor", "operate"), false);
  assert.equal(
    authorization.permissionFor("POST", "/api/servers/srv_1/admin/shutdown"),
    "operate",
  );
  assert.equal(
    authorization.permissionFor("POST", "/api/backup"),
    "manage_backups",
  );
});
