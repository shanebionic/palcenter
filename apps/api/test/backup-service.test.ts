import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { SqliteHistoryRepository } from "../src/repositories/sqlite-history-repository.js";
import { SqliteUserRepository } from "../src/repositories/sqlite-user-repository.js";
import {
  BackupService,
  InvalidBackupError,
} from "../src/services/backup-service.js";
import {
  createTarGzip,
  extractTarGzip,
} from "../src/services/tar-gzip-archive.js";
import { PasswordService } from "../src/services/password-service.js";

async function fixture() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "palcenter-test-"));
  await fs.writeFile(
    path.join(directory, "servers.json"),
    JSON.stringify({
      version: 1,
      servers: [
        {
          id: "srv_test",
          name: "Test Server",
          baseUrl: "http://127.0.0.1:8212",
          adminPassword: "secret-password",
          createdAt: "2026-07-23T00:00:00.000Z",
          updatedAt: "2026-07-23T00:00:00.000Z",
        },
      ],
    }),
  );
  await fs.writeFile(
    path.join(directory, "notifications.json"),
    JSON.stringify({
      version: 1,
      providers: [
        {
          id: "notification_test",
          type: "ntfy",
          name: "Test ntfy",
          enabled: true,
          events: ["server_offline"],
          serverUrl: "https://ntfy.sh",
          topic: "palcenter-test",
          createdAt: "2026-07-23T00:00:00.000Z",
          updatedAt: "2026-07-23T00:00:00.000Z",
        },
      ],
    }),
  );

  const history = new SqliteHistoryRepository(directory);
  history.initialize();
  history.saveSample(
    {
      serverId: "srv_test",
      status: "online",
      playerCount: 2,
      maxPlayers: 32,
      fps: 60,
      responseTimeMs: 10,
      uptimeSeconds: 100,
      capturedAt: "2026-07-23T00:00:00.000Z",
    },
    [
      {
        serverId: "srv_test",
        type: "server_online",
        playerId: null,
        playerName: null,
        occurredAt: "2026-07-23T00:00:00.000Z",
      },
    ],
    [],
  );
  const users = new SqliteUserRepository(directory);
  users.initialize();
  users.createInitial({
    id: "usr_test",
    username: "owner",
    email: "owner@example.com",
    passwordHash: await new PasswordService().hash("Strong-Password-123!"),
    role: "administrator",
    enabled: true,
    mustChangePassword: false,
    createdAt: "2026-07-23T00:00:00.000Z",
    updatedAt: "2026-07-23T00:00:00.000Z",
  });

  const lifecycle = {
    async pause() {
      history.close();
      users.close();
    },
    async resume() {
      history.reopen();
      users.reopen();
    },
  };

  return {
    directory,
    history,
    users,
    service: new BackupService(directory, "1.0.0-test", lifecycle),
  };
}

test("creates and restores all PalCenter data", async () => {
  const context = await fixture();

  try {
    const backup = await context.service.create();
    assert.match(
      backup.filename,
      /^palcenter-backup-\d{4}-\d{2}-\d{2}\.tar\.gz$/,
    );
    assert.equal(backup.metadata.formatVersion, 2);
    const archivePath = path.join(context.directory, backup.filename);
    await fs.writeFile(archivePath, backup.contents);
    const listing = spawnSync("tar", ["-tzf", archivePath], {
      encoding: "utf8",
    });
    assert.equal(listing.status, 0, listing.stderr);
    assert.deepEqual(listing.stdout.trim().split(/\r?\n/).sort(), [
      "history.sqlite",
      "metadata.json",
      "notifications.json",
      "servers.json",
      "users.sqlite",
    ]);

    await fs.writeFile(
      path.join(context.directory, "servers.json"),
      JSON.stringify({ version: 1, servers: [] }),
    );
    await fs.writeFile(
      path.join(context.directory, "notifications.json"),
      JSON.stringify({ version: 1, providers: [] }),
    );
    context.history.saveSample(
      {
        serverId: "srv_test",
        status: "offline",
        playerCount: null,
        maxPlayers: null,
        fps: null,
        responseTimeMs: null,
        uptimeSeconds: null,
        capturedAt: "2026-07-23T00:01:00.000Z",
      },
      [],
      [],
    );

    await context.service.restore(backup.contents);

    const servers = JSON.parse(
      await fs.readFile(path.join(context.directory, "servers.json"), "utf8"),
    ) as { servers: unknown[] };
    const notifications = JSON.parse(
      await fs.readFile(
        path.join(context.directory, "notifications.json"),
        "utf8",
      ),
    ) as { providers: unknown[] };

    assert.equal(servers.servers.length, 1);
    assert.equal(notifications.providers.length, 1);
    assert.equal(context.history.listMetrics("srv_test", 10).length, 1);
    assert.equal(context.history.listEvents("srv_test", 10).length, 1);
    assert.equal(context.users.list().length, 1);
  } finally {
    context.history.close();
    context.users.close();
    await fs.rm(context.directory, { recursive: true, force: true });
  }
});

test("rejects invalid uploads without changing current data", async () => {
  const context = await fixture();

  try {
    const before = await fs.readFile(
      path.join(context.directory, "servers.json"),
      "utf8",
    );
    await assert.rejects(
      context.service.restore(Buffer.from("not a backup")),
      InvalidBackupError,
    );
    assert.equal(
      await fs.readFile(path.join(context.directory, "servers.json"), "utf8"),
      before,
    );
    context.history.check();
  } finally {
    context.history.close();
    context.users.close();
    await fs.rm(context.directory, { recursive: true, force: true });
  }
});

test("restoring a format v1 backup preserves current users", async () => {
  const context = await fixture();
  try {
    const current = await context.service.create();
    const entries = extractTarGzip(current.contents);
    entries.delete("users.sqlite");
    entries.set(
      "metadata.json",
      Buffer.from(
        JSON.stringify({
          formatVersion: 1,
          palcenterVersion: "1.0.0-test",
          createdAt: new Date().toISOString(),
        }),
      ),
    );
    context.users.create({
      id: "usr_second",
      username: "second",
      email: "second@example.com",
      passwordHash: "scrypt$second-test-hash",
      role: "visitor",
      enabled: true,
      mustChangePassword: true,
      createdAt: "2026-07-23T00:00:00.000Z",
      updatedAt: "2026-07-23T00:00:00.000Z",
    });

    await context.service.restore(
      createTarGzip(
        [...entries].map(([name, contents]) => ({ name, contents })),
      ),
    );
    assert.equal(context.users.list().length, 2);
  } finally {
    context.history.close();
    context.users.close();
    await fs.rm(context.directory, { recursive: true, force: true });
  }
});
