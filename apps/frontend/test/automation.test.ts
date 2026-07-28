import assert from "node:assert/strict";
import test from "node:test";
import { describeSchedule, formatDateTime } from "../lib/automation";

test("friendly automation schedule descriptions avoid exposing cron for common schedules", () => {
  assert.equal(
    describeSchedule({ type: "every_minutes", interval: 15 }),
    "Every 15 minutes",
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

test("advanced schedules remain identifiable and missing timestamps are readable", () => {
  assert.equal(
    describeSchedule({ type: "cron", expression: "0 9 * * *" }),
    "Cron: 0 9 * * *",
  );
  assert.equal(formatDateTime(null), "Not yet");
});
