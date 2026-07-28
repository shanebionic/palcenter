import type { AutomationSchedule } from "../types/automation";

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
      return `Every ${schedule.interval} minute${schedule.interval === 1 ? "" : "s"}`;
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

export function taskTypeLabel(): string {
  return "Broadcast Message";
}
