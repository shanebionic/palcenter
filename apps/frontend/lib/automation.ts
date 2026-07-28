import type {
  AutomationSchedule,
  AutomationTask,
  AutomationTaskType,
} from "../types/automation";

const days = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export function describeSchedule(schedule: AutomationSchedule): string {
  switch (schedule.type) {
    case "every_minutes":
      return intervalScheduleDescription(
        schedule.interval,
        schedule.startMinute,
      );
    case "hourly":
      return `Hourly at :${String(schedule.minute).padStart(2, "0")}`;
    case "daily":
      return `Daily at ${schedule.time}`;
    case "weekly":
      return `${days[schedule.dayOfWeek]} at ${schedule.time}`;
    case "monthly":
      return `Monthly on day ${schedule.dayOfMonth} at ${schedule.time}`;
    case "specific_time":
      return `Once on ${formatDateTime(schedule.runAt)}`;
    case "cron":
      return `Cron: ${schedule.expression}`;
  }
}

export function intervalScheduleDescription(
  interval: number,
  startMinute: number,
): string {
  if (
    !Number.isInteger(interval) ||
    interval < 1 ||
    !Number.isInteger(startMinute) ||
    startMinute < 0 ||
    startMinute >= interval
  ) {
    return "Enter a valid interval and start minute.";
  }

  if (interval > 60) {
    return `Runs every ${interval} minutes with a wall-clock offset of ${startMinute} minutes.`;
  }

  const count = 60 / greatestCommonDivisor(60, interval);
  const marks = Array.from(
    { length: count },
    (_, index) => (startMinute + index * interval) % 60,
  )
    .sort((left, right) => left - right)
    .map((minute) => `:${String(minute).padStart(2, "0")}`);

  return `Runs every ${interval} minute${interval === 1 ? "" : "s"} at ${joinList(marks)}.`;
}

export function formatSchedulePreviewDate(
  value: string,
  timeZone: string,
): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unavailable";

  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone,
      dateStyle: "full",
      timeStyle: "long",
    }).format(date);
  } catch {
    return "Enter a valid IANA time zone.";
  }
}

export function formatDateTime(value: string | null): string {
  if (!value) return "Not yet";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unavailable"
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

export function taskTypeLabel(taskType: AutomationTaskType): string {
  switch (taskType) {
    case "broadcast_message":
      return "Broadcast Message";
    case "save_world":
      return "Save World";
    case "shutdown":
      return "Graceful Shutdown";
  }
}

export function taskConfigurationSummary(task: AutomationTask): string {
  switch (task.taskType) {
    case "broadcast_message":
      return truncate(task.configuration.message, 80);
    case "save_world":
      return "Save the current world state";
    case "shutdown": {
      const wait = `${task.configuration.waitTime} second${
        task.configuration.waitTime === 1 ? "" : "s"
      }`;
      const message = task.configuration.message?.trim();
      return message
        ? `Wait ${wait} · ${truncate(message, 60)}`
        : `Wait ${wait}`;
    }
  }
}

export function runNowConfirmation(task: AutomationTask): string | null {
  if (task.taskType !== "shutdown") return null;

  const configuredMessage = task.configuration.message?.trim();
  return [
    `Run “${task.name}” now?`,
    `Palworld will shut down after ${task.configuration.waitTime} seconds and connected players may be disconnected.`,
    configuredMessage ? `Player message: ${configuredMessage}` : null,
  ]
    .filter((value): value is string => value !== null)
    .join("\n\n");
}

function greatestCommonDivisor(left: number, right: number): number {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b !== 0) [a, b] = [b, a % b];
  return a;
}

function joinList(values: string[]): string {
  if (values.length <= 1) return values[0] ?? "";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")} and ${values.at(-1)}`;
}

function truncate(value: string, length: number): string {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}
