import type { AutomationSchedule } from "../types/automation.js";

export class InvalidAutomationScheduleError extends Error {}

interface ZonedParts {
  year: number;
  minute: number;
  hour: number;
  day: number;
  month: number;
  weekday: number;
}

interface CronFields {
  minutes: ReadonlySet<number>;
  hours: ReadonlySet<number>;
  days: ReadonlySet<number>;
  months: ReadonlySet<number>;
  weekdays: ReadonlySet<number>;
  anyDay: boolean;
  anyWeekday: boolean;
}

const weekdayIndexes: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export class ScheduleCalculator {
  nextRun(
    schedule: AutomationSchedule,
    timeZone: string,
    after: Date,
  ): string | null {
    this.validateTimeZone(timeZone);

    if (schedule.type === "specific_time") {
      const runAt = new Date(schedule.runAt);
      return runAt.getTime() > after.getTime() ? runAt.toISOString() : null;
    }

    if (schedule.type === "every_minutes") {
      return this.nextAlignedInterval(schedule, timeZone, after);
    }

    const cron =
      schedule.type === "cron" ? this.parseCron(schedule.expression) : null;
    const limit = 366 * 24 * 60;
    let candidate = Math.floor(after.getTime() / 60_000) * 60_000 + 60_000;

    for (let offset = 0; offset < limit; offset += 1) {
      const date = new Date(candidate);
      const parts = this.zonedParts(date, timeZone);

      if (
        (schedule.type === "hourly" && parts.minute === schedule.minute) ||
        (schedule.type === "daily" && this.matchesTime(parts, schedule.time)) ||
        (schedule.type === "weekly" &&
          parts.weekday === schedule.dayOfWeek &&
          this.matchesTime(parts, schedule.time)) ||
        (schedule.type === "monthly" &&
          parts.day === schedule.dayOfMonth &&
          this.matchesTime(parts, schedule.time)) ||
        (cron && this.matchesCron(parts, cron))
      ) {
        return date.toISOString();
      }

      candidate += 60_000;
    }

    throw new InvalidAutomationScheduleError(
      "The schedule does not produce a run within the next year.",
    );
  }

  validate(schedule: AutomationSchedule, timeZone: string): void {
    this.nextRun(schedule, timeZone, new Date());
  }

  private validateTimeZone(timeZone: string): void {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    } catch {
      throw new InvalidAutomationScheduleError(
        "Select a valid IANA time zone.",
      );
    }
  }

  private zonedParts(date: Date, timeZone: string): ZonedParts {
    const values = new Map(
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        minute: "2-digit",
        hour: "2-digit",
        day: "2-digit",
        month: "2-digit",
        weekday: "short",
        hourCycle: "h23",
      })
        .formatToParts(date)
        .map((part) => [part.type, part.value]),
    );

    return {
      year: Number(values.get("year")),
      minute: Number(values.get("minute")),
      hour: Number(values.get("hour")),
      day: Number(values.get("day")),
      month: Number(values.get("month")),
      weekday: weekdayIndexes[values.get("weekday") ?? ""] ?? -1,
    };
  }

  private nextAlignedInterval(
    schedule: Extract<AutomationSchedule, { type: "every_minutes" }>,
    timeZone: string,
    after: Date,
  ): string {
    const limit = Math.max(schedule.interval * 2, 366 * 24 * 60);
    let candidate = Math.floor(after.getTime() / 60_000) * 60_000 + 60_000;

    for (let offset = 0; offset < limit; offset += 1) {
      const date = new Date(candidate);
      const parts = this.zonedParts(date, timeZone);
      const localMinute = Math.floor(
        Date.UTC(
          parts.year,
          parts.month - 1,
          parts.day,
          parts.hour,
          parts.minute,
        ) / 60_000,
      );
      const phase =
        ((localMinute % schedule.interval) + schedule.interval) %
        schedule.interval;

      if (phase === schedule.startMinute) return date.toISOString();
      candidate += 60_000;
    }

    throw new InvalidAutomationScheduleError(
      "The interval does not produce a run within the supported range.",
    );
  }

  private matchesTime(parts: ZonedParts, time: string): boolean {
    const [hour, minute] = time.split(":").map(Number);
    return parts.hour === hour && parts.minute === minute;
  }

  private parseCron(expression: string): CronFields {
    const fields = expression.trim().split(/\s+/);

    if (fields.length !== 5) {
      throw new InvalidAutomationScheduleError(
        "Advanced schedules require five cron fields.",
      );
    }

    return {
      minutes: this.parseCronField(fields[0]!, 0, 59),
      hours: this.parseCronField(fields[1]!, 0, 23),
      days: this.parseCronField(fields[2]!, 1, 31),
      months: this.parseCronField(fields[3]!, 1, 12),
      weekdays: this.parseCronField(fields[4]!, 0, 6, true),
      anyDay: fields[2] === "*",
      anyWeekday: fields[4] === "*",
    };
  }

  private parseCronField(
    field: string,
    minimum: number,
    maximum: number,
    normalizeSunday = false,
  ): ReadonlySet<number> {
    const values = new Set<number>();

    for (const segment of field.split(",")) {
      const [rangeExpression, stepExpression] = segment.split("/");
      const step = stepExpression === undefined ? 1 : Number(stepExpression);

      if (!Number.isInteger(step) || step < 1) {
        throw new InvalidAutomationScheduleError(
          "Cron step values are invalid.",
        );
      }

      let start = minimum;
      let end = maximum;

      if (rangeExpression !== "*") {
        const range = rangeExpression!.split("-").map(Number);
        start = range[0]!;
        end = range.length === 1 ? start : range[1]!;
      }

      if (
        !Number.isInteger(start) ||
        !Number.isInteger(end) ||
        start < minimum ||
        end > maximum + (normalizeSunday ? 1 : 0) ||
        start > end
      ) {
        throw new InvalidAutomationScheduleError(
          "Cron field values are outside the supported range.",
        );
      }

      for (let value = start; value <= end; value += step) {
        values.add(normalizeSunday && value === 7 ? 0 : value);
      }
    }

    return values;
  }

  private matchesCron(parts: ZonedParts, cron: CronFields): boolean {
    const dayMatches = cron.days.has(parts.day);
    const weekdayMatches = cron.weekdays.has(parts.weekday);
    const calendarMatches =
      cron.anyDay || cron.anyWeekday
        ? dayMatches && weekdayMatches
        : dayMatches || weekdayMatches;

    return (
      cron.minutes.has(parts.minute) &&
      cron.hours.has(parts.hour) &&
      cron.months.has(parts.month) &&
      calendarMatches
    );
  }
}
