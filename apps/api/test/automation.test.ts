import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { JsonConnectionRepository } from "../src/repositories/json-connection-repository.js";
import { SqliteAutomationRepository } from "../src/repositories/sqlite-automation-repository.js";
import { SqliteHistoryRepository } from "../src/repositories/sqlite-history-repository.js";
import { AutomationService } from "../src/services/automation-service.js";
import {
  automationScheduleSchema,
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

test("automation tasks persist generically and dispatcher records manual execution", async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "palcenter-automation-"),
  );
  const history = new SqliteHistoryRepository(directory);
  const automation = new SqliteAutomationRepository(directory);
  const connections = new JsonConnectionRepository(directory);
  const calls: string[] = [];
  const executor: TaskExecutor = {
    execute(task) {
      calls.push(task.configuration.message);
      return Promise.resolve();
    },
  };

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
      new TaskDispatcher(new Map([["broadcast_message", executor]])),
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
      name: task.name,
      serverId: task.serverId,
      enabled: true,
      taskType: task.taskType,
      schedule: {
        type: "every_minutes",
        interval: 30,
        startMinute: 15,
      },
      timeZone: "UTC",
      configuration: task.configuration,
    });
    assert.ok(updated.nextRunAt);
    assert.ok([15, 45].includes(new Date(updated.nextRunAt).getUTCMinutes()));

    automation.close();
    automation.reopen();
    assert.equal((await service.get(task.id)).name, "Welcome message");
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
        new Map([
          [
            "broadcast_message",
            {
              execute: () => Promise.reject(new Error("Server offline")),
            },
          ],
        ]),
      ),
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
  } finally {
    automation.close();
    history.close();
    await fs.rm(directory, { recursive: true, force: true });
  }
});
