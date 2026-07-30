import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { SqliteHistoryRepository } from "../src/repositories/sqlite-history-repository.js";
import { SqliteWorldEventRepository } from "../src/repositories/sqlite-world-event-repository.js";
import { SqliteAutomationRepository } from "../src/repositories/sqlite-automation-repository.js";
import { SqliteUserRepository } from "../src/repositories/sqlite-user-repository.js";
import { SystemConfigurationRepository } from "../src/repositories/system-configuration-repository.js";
import {
  BackupService,
  InvalidBackupError,
} from "../src/services/backup-service.js";
import {
  createTarGzip,
  extractTarGzip,
} from "../src/services/tar-gzip-archive.js";
import { PasswordService } from "../src/services/password-service.js";
import { SqliteTelemetryRepository } from "../src/telemetry/repositories/sqlite-telemetry-repository.js";

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
  const telemetry = new SqliteTelemetryRepository(directory);
  telemetry.initialize();
  telemetry.insertPlayerSnapshots([
    {
      serverId: "srv_test",
      userId: "user_test",
      playerId: "player_test",
      playerName: "Backup Player",
      accountName: "backup-account",
      capturedAt: "2026-07-23T00:00:00.000Z",
      x: 100,
      y: 200,
      z: null,
      level: 10,
      ping: 20,
      buildingCount: 1,
      guildId: null,
      guildName: null,
    },
  ]);
  const worldEvents = new SqliteWorldEventRepository(directory);
  worldEvents.initialize();
  worldEvents.append([
    {
      id: "wie_backup",
      serverId: "srv_test",
      userId: "user_test",
      playerId: "player_test",
      timestamp: "2026-07-23T00:00:00.000Z",
      type: "session_started",
      metadata: { playerName: "Backup Player" },
      confidence: 1,
      evidence: [
        { source: "players", fact: "appeared", value: "online_roster" },
      ],
      position: { x: 100, y: 200, z: null },
    },
  ]);
  const automation = new SqliteAutomationRepository(directory);
  automation.initialize();
  automation.createTask({
    id: "task_test",
    name: "Backup test broadcast",
    serverId: "srv_test",
    enabled: true,
    taskType: "broadcast_message",
    schedule: { type: "daily", time: "09:00" },
    timeZone: "UTC",
    configuration: { message: "This task must survive restore." },
    lastRunAt: null,
    nextRunAt: "2026-07-24T09:00:00.000Z",
    lastResult: null,
    lastError: null,
    createdAt: "2026-07-23T00:00:00.000Z",
    updatedAt: "2026-07-23T00:00:00.000Z",
  });
  const saveTask = {
    id: "task_save",
    name: "Backup test save",
    serverId: "srv_test",
    enabled: true,
    taskType: "save_world" as const,
    schedule: { type: "daily" as const, time: "10:00" },
    timeZone: "UTC",
    configuration: {},
    lastRunAt: null,
    nextRunAt: "2026-07-24T10:00:00.000Z",
    lastResult: null,
    lastError: null,
    createdAt: "2026-07-23T00:00:00.000Z",
    updatedAt: "2026-07-23T00:00:00.000Z",
  };
  automation.createTask(saveTask);
  automation.createTask({
    ...saveTask,
    id: "task_shutdown",
    name: "Backup test shutdown",
    taskType: "shutdown",
    configuration: { waitTime: 60, message: "Maintenance" },
  });
  const executionId = automation.beginExecution(
    saveTask,
    {
      taskName: saveTask.name,
      taskType: saveTask.taskType,
      serverId: saveTask.serverId,
      serverName: "Test Server",
      actionSummary: "Save the current world state",
    },
    "manual",
    "2026-07-23T00:01:00.000Z",
    saveTask.nextRunAt,
    true,
  );
  automation.completeExecution(
    executionId,
    saveTask.id,
    "success",
    "2026-07-23T00:01:01.000Z",
    1_000,
    null,
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
  const system = await new SystemConfigurationRepository(directory).initialize(
    "fixture-session-secret-at-least-32-characters",
  );

  const lifecycle = {
    async pause() {
      automation.close();
      history.close();
      telemetry.close();
      worldEvents.close();
      users.close();
    },
    async resume() {
      history.reopen();
      telemetry.reopen();
      worldEvents.reopen();
      automation.reopen();
      users.reopen();
    },
  };

  return {
    directory,
    history,
    telemetry,
    worldEvents,
    automation,
    users,
    system,
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
    assert.equal(backup.metadata.formatVersion, 3);
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
      "system.json",
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
    await fs.writeFile(
      path.join(context.directory, "system.json"),
      JSON.stringify({
        ...context.system.configuration,
        sessionSecret: "replacement-session-secret-at-least-32-characters",
      }),
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
    assert.equal(context.telemetry.latestPlayerSnapshots("srv_test").length, 1);
    assert.equal(context.worldEvents.list("srv_test", { limit: 10 }).length, 1);
    assert.equal(
      context.automation.getTask("task_test")?.configuration.message,
      "This task must survive restore.",
    );
    assert.deepEqual(
      context.automation.getTask("task_shutdown")?.configuration,
      { waitTime: 60, message: "Maintenance" },
    );
    assert.equal(context.automation.listExecutions("task_save", 10).length, 1);
    assert.equal(context.users.list().length, 1);
    const restoredSystem = await new SystemConfigurationRepository(
      context.directory,
    ).read();
    assert.deepEqual(restoredSystem, context.system.configuration);
  } finally {
    context.history.close();
    context.telemetry.close();
    context.worldEvents.close();
    context.automation.close();
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
    context.telemetry.close();
    context.worldEvents.close();
    context.automation.close();
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
    entries.delete("system.json");
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
    assert.deepEqual(
      await new SystemConfigurationRepository(context.directory).read(),
      context.system.configuration,
    );
  } finally {
    context.history.close();
    context.telemetry.close();
    context.worldEvents.close();
    context.automation.close();
    context.users.close();
    await fs.rm(context.directory, { recursive: true, force: true });
  }
});

test("restoring a format v2 backup preserves current system configuration", async () => {
  const context = await fixture();
  try {
    const current = await context.service.create();
    const entries = extractTarGzip(current.contents);
    entries.delete("system.json");
    entries.set(
      "metadata.json",
      Buffer.from(
        JSON.stringify({
          formatVersion: 2,
          palcenterVersion: "1.0.0-test",
          createdAt: new Date().toISOString(),
        }),
      ),
    );

    await context.service.restore(
      createTarGzip(
        [...entries].map(([name, contents]) => ({ name, contents })),
      ),
    );
    assert.deepEqual(
      await new SystemConfigurationRepository(context.directory).read(),
      context.system.configuration,
    );
  } finally {
    context.history.close();
    context.telemetry.close();
    context.worldEvents.close();
    context.automation.close();
    context.users.close();
    await fs.rm(context.directory, { recursive: true, force: true });
  }
});
