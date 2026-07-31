import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { JsonConnectionRepository } from "../src/repositories/json-connection-repository.js";
import { SqliteAutomationRepository } from "../src/repositories/sqlite-automation-repository.js";
import { SqliteHistoryRepository } from "../src/repositories/sqlite-history-repository.js";
import { AutomationService } from "../src/services/automation-service.js";
import { AutomationExecutionSnapshotService } from "../src/services/automation-execution-snapshot-service.js";
import {
  automationScheduleSchema,
  automationTaskInputSchema,
  storedAutomationScheduleSchema,
} from "../src/services/automation-validation.js";
import { ScheduleCalculator } from "../src/services/schedule-calculator.js";
import { SchedulerService } from "../src/services/scheduler-service.js";
import { TaskDispatcher } from "../src/services/task-dispatcher.js";
import type { TaskExecutor } from "../src/services/task-executor.js";
import type { StoredConnection } from "../src/types/connections.js";

const connection: StoredConnection = {
  id: "srv_test",
  name: "Test Server",
  baseUrl: "http://127.0.0.1:8212",
  adminPassword: "test-only",
  createdAt: "2026-07-27T12:00:00.000Z",
  updatedAt: "2026-07-27T12:00:00.000Z",
};

function executors(
  broadcastMessage: TaskExecutor<"broadcast_message">,
  saveWorld: TaskExecutor<"save_world"> = { execute: () => Promise.resolve() },
  shutdown: TaskExecutor<"shutdown"> = { execute: () => Promise.resolve() },
) {
  return {
    broadcast_message: broadcastMessage,
    save_world: saveWorld,
    shutdown,
  };
}

test("friendly and cron schedules calculate future runs in the selected time zone", () => {
  const calculator = new ScheduleCalculator();
  const now = new Date("2026-07-27T12:34:30.000Z");

  assert.equal(
    calculator.nextRun(
      { type: "every_minutes", interval: 15, startMinute: 5 },
      "UTC",
      now,
    ),
    "2026-07-27T12:35:00.000Z",
  );
  assert.equal(
    calculator.nextRun(
      { type: "every_minutes", interval: 30, startMinute: 15 },
      "America/New_York",
      new Date("2026-07-27T22:16:00.000Z"),
    ),
    "2026-07-27T22:45:00.000Z",
  );
  assert.equal(
    calculator.nextRun({ type: "hourly", minute: 45 }, "UTC", now),
    "2026-07-27T12:45:00.000Z",
  );
  assert.equal(
    calculator.nextRun({ type: "daily", time: "13:00" }, "UTC", now),
    "2026-07-27T13:00:00.000Z",
  );
  assert.equal(
    calculator.nextRun(
      { type: "weekly", dayOfWeek: 1, time: "14:00" },
      "UTC",
      now,
    ),
    "2026-07-27T14:00:00.000Z",
  );
  assert.equal(
    calculator.nextRun(
      { type: "monthly", dayOfMonth: 28, time: "08:00" },
      "UTC",
      now,
    ),
    "2026-07-28T08:00:00.000Z",
  );
  assert.equal(
    calculator.nextRun({ type: "cron", expression: "0 9 * * *" }, "UTC", now),
    "2026-07-28T09:00:00.000Z",
  );
  assert.equal(
    calculator.nextRun(
      { type: "specific_time", runAt: "2026-07-28T10:00:00.000Z" },
      "UTC",
      now,
    ),
    "2026-07-28T10:00:00.000Z",
  );
});

test("interval schedules validate their phase and migrate legacy values safely", () => {
  assert.equal(
    storedAutomationScheduleSchema.parse({
      type: "every_minutes",
      interval: 30,
    }).startMinute,
    0,
  );
  assert.throws(() =>
    automationScheduleSchema.parse({
      type: "every_minutes",
      interval: 30,
      startMinute: 30,
    }),
  );
  assert.deepEqual(
    automationScheduleSchema.parse({
      type: "every_minutes",
      interval: 60,
      startMinute: 59,
    }),
    { type: "every_minutes", interval: 60, startMinute: 59 },
  );
});

test("task-specific configuration is exhaustive and rejects unsupported or malformed tasks", () => {
  const common = {
    name: "Task",
    serverId: connection.id,
    enabled: true,
    schedule: { type: "daily" as const, time: "09:00" },
    timeZone: "UTC",
  };

  assert.deepEqual(
    automationTaskInputSchema.parse({
      ...common,
      taskType: "save_world",
      configuration: {},
    }).configuration,
    {},
  );
  for (const waitTime of [0, 86_400]) {
    assert.equal(
      automationTaskInputSchema.parse({
        ...common,
        taskType: "shutdown",
        configuration: { waitTime, message: "Maintenance" },
      }).configuration.waitTime,
      waitTime,
    );
  }
  for (const waitTime of [-1, 86_401, 1.5]) {
    assert.throws(() =>
      automationTaskInputSchema.parse({
        ...common,
        taskType: "shutdown",
        configuration: { waitTime },
      }),
    );
  }
  assert.throws(() =>
    automationTaskInputSchema.parse({
      ...common,
      taskType: "force_stop",
      configuration: {},
    }),
  );
});

test("automation tasks persist generically and dispatcher records manual execution", async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "palcenter-automation-"),
  );
  const history = new SqliteHistoryRepository(directory);
  const automation = new SqliteAutomationRepository(directory);
  const connections = new JsonConnectionRepository(directory);
  const calls: string[] = [];
  const executor: TaskExecutor<"broadcast_message"> = {
    execute(task) {
      calls.push(task.configuration.message);
      return Promise.resolve();
    },
  };
  const secondConnection: StoredConnection = {
    ...connection,
    id: "srv_second",
    name: "Second Server",
  };

  try {
    await connections.initialize();
    await connections.create(connection);
    await connections.create(secondConnection);
    history.initialize();
    automation.initialize();
    const calculator = new ScheduleCalculator();
    const service = new AutomationService(automation, connections, calculator);
    const scheduler = new SchedulerService(
      automation,
      calculator,
      new TaskDispatcher(executors(executor)),
      new AutomationExecutionSnapshotService(connections),
      60_000,
      () => undefined,
    );
    const task = await service.create({
      name: "Welcome message",
      serverId: connection.id,
      enabled: true,
      taskType: "broadcast_message",
      schedule: { type: "every_minutes", interval: 30, startMinute: 0 },
      timeZone: "UTC",
      configuration: { message: "Welcome to the server" },
    });

    assert.equal((await service.list())[0]?.serverName, connection.name);
    const execution = await scheduler.runNow(task.id);
    assert.equal(execution.result, "success");
    assert.deepEqual(calls, ["Welcome to the server"]);
    assert.equal((await service.get(task.id)).lastResult, "success");

    const updated = await service.update(task.id, {
      name: "Renamed task",
      serverId: secondConnection.id,
      enabled: true,
      taskType: task.taskType,
      schedule: {
        type: "every_minutes",
        interval: 30,
        startMinute: 15,
      },
      timeZone: "UTC",
      configuration: { message: "Edited message" },
    });
    assert.ok(updated.nextRunAt);
    assert.ok([15, 45].includes(new Date(updated.nextRunAt).getUTCMinutes()));

    automation.close();
    automation.reopen();
    assert.equal((await service.get(task.id)).name, "Renamed task");
    const [historical] = await service.history(task.id, 10);
    assert.equal(historical?.metadataSource, "snapshot");
    assert.equal(historical?.taskName, "Welcome message");
    assert.equal(historical?.serverId, connection.id);
    assert.equal(historical?.serverName, connection.name);
    assert.equal(
      historical?.actionSummary,
      "Broadcast message: Welcome to the server",
    );
    assert.doesNotMatch(
      JSON.stringify(historical),
      /test-only|Edited message|Second Server/,
    );
  } finally {
    automation.close();
    history.close();
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("failed task executions are retained without stopping the scheduler", async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "palcenter-automation-failure-"),
  );
  const history = new SqliteHistoryRepository(directory);
  const automation = new SqliteAutomationRepository(directory);
  const connections = new JsonConnectionRepository(directory);

  try {
    await connections.initialize();
    await connections.create(connection);
    history.initialize();
    automation.initialize();
    const calculator = new ScheduleCalculator();
    const service = new AutomationService(automation, connections, calculator);
    const scheduler = new SchedulerService(
      automation,
      calculator,
      new TaskDispatcher(
        executors({
          execute: () => Promise.reject(new Error("Server offline")),
        }),
      ),
      new AutomationExecutionSnapshotService(connections),
      60_000,
      () => undefined,
    );
    const task = await service.create({
      name: "Expected failure",
      serverId: connection.id,
      enabled: false,
      taskType: "broadcast_message",
      schedule: { type: "daily", time: "09:00" },
      timeZone: "UTC",
      configuration: { message: "Test" },
    });

    const execution = await scheduler.runNow(task.id);
    assert.equal(execution.result, "failure");
    assert.equal(execution.errorMessage, "Server offline");
    assert.equal((await service.get(task.id)).lastError, "Server offline");
    await service.update(task.id, {
      name: "Edited failed task",
      serverId: task.serverId,
      enabled: false,
      taskType: "broadcast_message",
      schedule: task.schedule,
      timeZone: task.timeZone,
      configuration: { message: "Edited after failure" },
    });
    const [historyEntry] = await service.history(task.id, 10);
    assert.equal(historyEntry?.trigger, "manual");
    assert.equal(historyEntry?.resultMessage, "Server offline");
    assert.equal(historyEntry?.taskName, task.name);
    assert.equal(historyEntry?.serverName, connection.name);
    assert.equal(historyEntry?.actionSummary, "Broadcast message: Test");
    assert.equal(historyEntry?.metadataSource, "snapshot");
    assert.ok((historyEntry?.durationMs ?? -1) >= 0);
  } finally {
    automation.close();
    history.close();
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("save world and graceful shutdown execute through registered task executors", async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "palcenter-automation-operations-"),
  );
  const automation = new SqliteAutomationRepository(directory);
  const connections = new JsonConnectionRepository(directory);
  const history = new SqliteHistoryRepository(directory);
  const calls: string[] = [];

  try {
    await connections.initialize();
    await connections.create(connection);
    history.initialize();
    automation.initialize();
    const calculator = new ScheduleCalculator();
    const service = new AutomationService(automation, connections, calculator);
    const scheduler = new SchedulerService(
      automation,
      calculator,
      new TaskDispatcher(
        executors(
          { execute: () => Promise.resolve() },
          {
            execute: (task) => {
              calls.push(`save:${task.serverId}`);
              return Promise.resolve();
            },
          },
          {
            execute: (task) => {
              calls.push(
                `shutdown:${task.configuration.waitTime}:${task.configuration.message ?? ""}`,
              );
              return Promise.resolve();
            },
          },
        ),
      ),
      new AutomationExecutionSnapshotService(connections),
      60_000,
      () => undefined,
    );
    const save = await service.create({
      name: "Save world",
      serverId: connection.id,
      enabled: true,
      taskType: "save_world",
      schedule: { type: "daily", time: "09:00" },
      timeZone: "UTC",
      configuration: {},
    });
    const shutdown = await service.create({
      name: "Maintenance shutdown",
      serverId: connection.id,
      enabled: true,
      taskType: "shutdown",
      schedule: { type: "daily", time: "10:00" },
      timeZone: "UTC",
      configuration: { waitTime: 60, message: "Maintenance" },
    });
    const saveNextRun = save.nextRunAt;
    const shutdownNextRun = shutdown.nextRunAt;

    assert.equal((await scheduler.runNow(save.id)).result, "success");
    assert.equal((await scheduler.runNow(shutdown.id)).result, "success");
    assert.deepEqual(calls, [
      `save:${connection.id}`,
      "shutdown:60:Maintenance",
    ]);
    assert.equal((await service.get(save.id)).nextRunAt, saveNextRun);
    assert.equal((await service.get(shutdown.id)).nextRunAt, shutdownNextRun);
    await service.update(shutdown.id, {
      name: "Edited shutdown",
      serverId: shutdown.serverId,
      enabled: true,
      taskType: "shutdown",
      schedule: shutdown.schedule,
      timeZone: shutdown.timeZone,
      configuration: { waitTime: 300, message: "Edited maintenance" },
    });
    const [shutdownHistory] = await service.history(shutdown.id, 10);
    assert.equal(shutdownHistory?.taskName, "Maintenance shutdown");
    assert.equal(
      shutdownHistory?.actionSummary,
      "Graceful shutdown after 60 seconds: Maintenance",
    );

    automation.updateTask(
      save.id,
      {
        name: save.name,
        serverId: save.serverId,
        enabled: true,
        taskType: "save_world",
        schedule: save.schedule,
        timeZone: save.timeZone,
        configuration: {},
      },
      "2026-01-01T00:00:00.000Z",
    );
    await scheduler.tick();
    const saveHistory = await service.history(save.id, 10);
    assert.deepEqual(
      saveHistory.map((entry) => entry.trigger),
      ["scheduled", "manual"],
    );
    assert.equal(
      saveHistory[0]?.resultMessage,
      "World save completed successfully.",
    );

    automation.close();
    automation.reopen();
    assert.equal((await service.get(save.id)).taskType, "save_world");
    assert.deepEqual(
      (await service.history(save.id, 10)).map((entry) => entry.metadataSource),
      ["snapshot", "snapshot"],
    );
    assert.deepEqual((await service.get(shutdown.id)).configuration, {
      waitTime: 300,
      message: "Edited maintenance",
    });
    assert.equal(automation.listExecutions(shutdown.id, 10).length, 1);
    await service.delete(shutdown.id);
    assert.equal(automation.listExecutions(shutdown.id, 10).length, 0);
  } finally {
    automation.close();
    history.close();
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("the same task cannot overlap while a previous execution is running", async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "palcenter-automation-overlap-"),
  );
  const automation = new SqliteAutomationRepository(directory);
  const connections = new JsonConnectionRepository(directory);
  const history = new SqliteHistoryRepository(directory);
  let release: (() => void) | undefined;
  let executionStarted: (() => void) | undefined;
  const started = new Promise<void>((resolve) => {
    executionStarted = resolve;
  });

  try {
    await connections.initialize();
    await connections.create(connection);
    history.initialize();
    automation.initialize();
    const calculator = new ScheduleCalculator();
    const service = new AutomationService(automation, connections, calculator);
    const scheduler = new SchedulerService(
      automation,
      calculator,
      new TaskDispatcher(
        executors({
          execute: () =>
            new Promise<void>((resolve) => {
              release = resolve;
              executionStarted?.();
            }),
        }),
      ),
      new AutomationExecutionSnapshotService(connections),
      60_000,
      () => undefined,
    );
    const task = await service.create({
      name: "Overlap test",
      serverId: connection.id,
      enabled: true,
      taskType: "broadcast_message",
      schedule: { type: "daily", time: "09:00" },
      timeZone: "UTC",
      configuration: { message: "Test" },
    });

    const first = scheduler.runNow(task.id);
    await started;
    await assert.rejects(scheduler.runNow(task.id), /already running/);
    release?.();
    assert.equal((await first).result, "success");
    assert.equal(automation.listExecutions(task.id, 10).length, 1);
  } finally {
    automation.close();
    history.close();
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("schema version 2 execution rows migrate and remain readable as legacy metadata", async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "palcenter-automation-legacy-"),
  );
  const databasePath = path.join(directory, "history.sqlite");
  const legacy = new DatabaseSync(databasePath);
  legacy.exec(`
    CREATE TABLE task_executions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      server_id TEXT NOT NULL,
      task_type TEXT NOT NULL,
      trigger TEXT NOT NULL CHECK (trigger IN ('scheduled', 'manual')),
      result TEXT NOT NULL CHECK (result IN ('running', 'success', 'failure')),
      started_at TEXT NOT NULL,
      finished_at TEXT,
      duration_ms INTEGER,
      error_message TEXT,
      FOREIGN KEY (task_id) REFERENCES scheduled_tasks (id) ON DELETE CASCADE
    );
    PRAGMA user_version = 2;
  `);
  legacy.close();

  const history = new SqliteHistoryRepository(directory);
  const automation = new SqliteAutomationRepository(directory);
  const connections = new JsonConnectionRepository(directory);

  try {
    history.initialize();
    automation.initialize();
    await connections.initialize();
    await connections.create(connection);
    const calculator = new ScheduleCalculator();
    const service = new AutomationService(automation, connections, calculator);
    const task = await service.create({
      name: "Legacy task",
      serverId: connection.id,
      enabled: false,
      taskType: "broadcast_message",
      schedule: { type: "daily", time: "09:00" },
      timeZone: "UTC",
      configuration: { message: "Current fallback description" },
    });
    const writer = new DatabaseSync(databasePath);
    writer
      .prepare(
        `INSERT INTO task_executions (
          task_id, server_id, task_type, trigger, result, started_at,
          finished_at, duration_ms, error_message
        ) VALUES (?, ?, ?, 'manual', 'success', ?, ?, 1000, NULL)`,
      )
      .run(
        task.id,
        task.serverId,
        task.taskType,
        "2026-07-28T00:00:00.000Z",
        "2026-07-28T00:00:01.000Z",
      );
    writer.close();

    const [execution] = await service.history(task.id, 10);
    assert.equal(execution?.metadataSource, "legacy_current_task");
    assert.equal(execution?.taskName, "Legacy task");
    assert.equal(
      execution?.actionSummary,
      "Broadcast message: Current fallback description",
    );
    const migrated = new DatabaseSync(databasePath);
    const version = migrated.prepare("PRAGMA user_version").get() as {
      user_version: number;
    };
    const columns = migrated
      .prepare("PRAGMA table_info(task_executions)")
      .all() as unknown as { name: string }[];
    migrated.close();
    assert.equal(version.user_version, 7);
    assert.ok(columns.some((column) => column.name === "snapshot_json"));
  } finally {
    automation.close();
    history.close();
    await fs.rm(directory, { recursive: true, force: true });
  }
});
