import assert from "node:assert/strict";
import test from "node:test";
import {
  describeSchedule,
  formatDateTime,
  formatSchedulePreviewDate,
  intervalScheduleDescription,
  runNowConfirmation,
  taskConfigurationSummary,
  taskTypeLabel,
} from "../lib/automation";
import type { AutomationTask } from "../types/automation";

test("friendly automation schedule descriptions avoid exposing cron for common schedules", () => {
  assert.equal(
    describeSchedule({
      type: "every_minutes",
      interval: 15,
      startMinute: 5,
    }),
    "Runs every 15 minutes at :05, :20, :35 and :50.",
  );
  assert.equal(
    describeSchedule({ type: "weekly", dayOfWeek: 1, time: "09:30" }),
    "Monday at 09:30",
  );
  assert.equal(
    describeSchedule({ type: "monthly", dayOfMonth: 1, time: "08:00" }),
    "Monthly on day 1 at 08:00",
  );
});

test("aligned interval descriptions show each wall-clock minute", () => {
  assert.equal(
    intervalScheduleDescription(30, 0),
    "Runs every 30 minutes at :00 and :30.",
  );
  assert.equal(
    intervalScheduleDescription(30, 15),
    "Runs every 30 minutes at :15 and :45.",
  );
  assert.equal(
    intervalScheduleDescription(15, 5),
    "Runs every 15 minutes at :05, :20, :35 and :50.",
  );
  assert.equal(
    intervalScheduleDescription(15, 15),
    "Enter a valid interval and start minute.",
  );
  assert.equal(
    intervalScheduleDescription(90, 75),
    "Runs every 90 minutes with a wall-clock offset of 75 minutes.",
  );
});

test("schedule preview formats the next run in the configured time zone", () => {
  const value = formatSchedulePreviewDate(
    "2026-07-28T03:30:00.000Z",
    "America/New_York",
  );
  assert.match(value, /July 27, 2026/);
  assert.match(value, /11:30/);
  assert.match(value, /EDT/);
});

test("automation task labels and summaries cover every server operation", () => {
  const common = {
    id: "task_test",
    name: "Task",
    serverId: "srv_test",
    serverName: "Server",
    enabled: true,
    schedule: { type: "daily" as const, time: "09:00" },
    timeZone: "UTC",
    lastRunAt: null,
    nextRunAt: null,
    lastResult: null,
    lastError: null,
    createdAt: "2026-07-28T00:00:00.000Z",
    updatedAt: "2026-07-28T00:00:00.000Z",
  };
  const tasks: AutomationTask[] = [
    {
      ...common,
      taskType: "broadcast_message",
      configuration: { message: "Welcome to Palworld" },
    },
    { ...common, taskType: "save_world", configuration: {} },
    {
      ...common,
      taskType: "shutdown",
      configuration: { waitTime: 60, message: "Maintenance" },
    },
  ];

  assert.deepEqual(
    tasks.map((task) => taskTypeLabel(task.taskType)),
    ["Broadcast Message", "Save World", "Graceful Shutdown"],
  );
  assert.deepEqual(tasks.map(taskConfigurationSummary), [
    "Welcome to Palworld",
    "Save the current world state",
    "Wait 60 seconds · Maintenance",
  ]);
  assert.equal(runNowConfirmation(tasks[0]!), null);
  assert.equal(runNowConfirmation(tasks[1]!), null);
  assert.match(runNowConfirmation(tasks[2]!) ?? "", /60 seconds/);
  assert.match(runNowConfirmation(tasks[2]!) ?? "", /Maintenance/);
});

test("advanced schedules remain identifiable and missing timestamps are readable", () => {
  assert.equal(
    describeSchedule({ type: "cron", expression: "0 9 * * *" }),
    "Cron: 0 9 * * *",
  );
  assert.equal(formatDateTime(null), "Not yet");
});
