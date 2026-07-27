import { z } from "zod";
import type {
  AutomationTaskConfiguration,
  AutomationTaskInput,
} from "../types/automation.js";

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a 24-hour time such as 09:30.");

export const automationScheduleSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("every_minutes"),
      interval: z.number().int().min(1).max(10_080),
    })
    .strict(),
  z
    .object({
      type: z.literal("hourly"),
      minute: z.number().int().min(0).max(59),
    })
    .strict(),
  z.object({ type: z.literal("daily"), time: timeSchema }).strict(),
  z
    .object({
      type: z.literal("weekly"),
      dayOfWeek: z.number().int().min(0).max(6),
      time: timeSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("monthly"),
      dayOfMonth: z.number().int().min(1).max(31),
      time: timeSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("specific_time"),
      runAt: z.string().datetime({ offset: true }),
    })
    .strict(),
  z
    .object({
      type: z.literal("cron"),
      expression: z.string().trim().min(9).max(100),
    })
    .strict(),
]);

export const broadcastConfigurationSchema = z
  .object({
    message: z.string().trim().min(1).max(500),
  })
  .strict();

export const automationTaskInputSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    serverId: z.string().min(1).max(100),
    enabled: z.boolean(),
    taskType: z.literal("broadcast_message"),
    schedule: automationScheduleSchema,
    timeZone: z.string().trim().min(1).max(100),
    configuration: broadcastConfigurationSchema,
  })
  .strict();

export function parseAutomationTaskInput(value: unknown): AutomationTaskInput {
  return automationTaskInputSchema.parse(value);
}

export function parseTaskConfiguration(
  taskType: AutomationTaskInput["taskType"],
  value: unknown,
): AutomationTaskConfiguration {
  switch (taskType) {
    case "broadcast_message":
      return broadcastConfigurationSchema.parse(value);
  }
}
