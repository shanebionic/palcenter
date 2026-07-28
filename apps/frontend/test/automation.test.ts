import assert from "node:assert/strict";
import test from "node:test";
import {
  describeSchedule,
  formatDateTime,
  formatSchedulePreviewDate,
  intervalScheduleDescription,
} from "../lib/automation";

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

test("advanced schedules remain identifiable and missing timestamps are readable", () => {
  assert.equal(
    describeSchedule({ type: "cron", expression: "0 9 * * *" }),
    "Cron: 0 9 * * *",
  );
  assert.equal(formatDateTime(null), "Not yet");
});
