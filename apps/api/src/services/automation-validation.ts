import { z } from "zod";
import type {
  AutomationTaskConfiguration,
  AutomationTaskInput,
} from "../types/automation.js";

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a 24-hour time such as 09:30.");

const intervalScheduleSchema = z
  .object({
    type: z.literal("every_minutes"),
    interval: z.number().int().min(1).max(10_080),
    startMinute: z.number().int().min(0).max(10_079),
  })
  .strict()
  .refine((value) => value.startMinute < value.interval, {
    path: ["startMinute"],
    message: "Start minute must be less than the interval.",
  });

const hourlyScheduleSchema = z
  .object({
    type: z.literal("hourly"),
    minute: z.number().int().min(0).max(59),
  })
  .strict();
const dailyScheduleSchema = z
  .object({ type: z.literal("daily"), time: timeSchema })
  .strict();
const weeklyScheduleSchema = z
  .object({
    type: z.literal("weekly"),
    dayOfWeek: z.number().int().min(0).max(6),
    time: timeSchema,
  })
  .strict();
const monthlyScheduleSchema = z
  .object({
    type: z.literal("monthly"),
    dayOfMonth: z.number().int().min(1).max(31),
    time: timeSchema,
  })
  .strict();
const specificTimeScheduleSchema = z
  .object({
    type: z.literal("specific_time"),
    runAt: z.string().datetime({ offset: true }),
  })
  .strict();
const cronScheduleSchema = z
  .object({
    type: z.literal("cron"),
    expression: z.string().trim().min(9).max(100),
  })
  .strict();

export const automationScheduleSchema = z.union([
  intervalScheduleSchema,
  hourlyScheduleSchema,
  dailyScheduleSchema,
  weeklyScheduleSchema,
  monthlyScheduleSchema,
  specificTimeScheduleSchema,
  cronScheduleSchema,
]);

export const storedAutomationScheduleSchema = z.union([
  z
    .object({
      type: z.literal("every_minutes"),
      interval: z.number().int().min(1).max(10_080),
      startMinute: z.number().int().min(0).max(10_079).optional(),
    })
    .strict()
    .refine(
      (value) =>
        value.startMinute === undefined || value.startMinute < value.interval,
      {
        path: ["startMinute"],
        message: "Start minute must be less than the interval.",
      },
    )
    .transform((value) => ({ ...value, startMinute: value.startMinute ?? 0 })),
  hourlyScheduleSchema,
  dailyScheduleSchema,
  weeklyScheduleSchema,
  monthlyScheduleSchema,
  specificTimeScheduleSchema,
  cronScheduleSchema,
]);

export const broadcastConfigurationSchema = z
  .object({
    message: z.string().trim().min(1).max(500),
  })
  .strict();

export const saveWorldConfigurationSchema = z.object({}).strict();

export const shutdownConfigurationSchema = z
  .object({
    waitTime: z.number().int().min(0).max(86_400),
    message: z.string().trim().max(500).optional(),
  })
  .strict();

const taskInputFields = {
  name: z.string().trim().min(1).max(100),
  serverId: z.string().min(1).max(100),
  enabled: z.boolean(),
  schedule: automationScheduleSchema,
  timeZone: z.string().trim().min(1).max(100),
};

export const automationTaskInputSchema = z.discriminatedUnion("taskType", [
  z
    .object({
      ...taskInputFields,
      taskType: z.literal("broadcast_message"),
      configuration: broadcastConfigurationSchema,
    })
    .strict(),
  z
    .object({
      ...taskInputFields,
      taskType: z.literal("save_world"),
      configuration: saveWorldConfigurationSchema,
    })
    .strict(),
  z
    .object({
      ...taskInputFields,
      taskType: z.literal("shutdown"),
      configuration: shutdownConfigurationSchema,
    })
    .strict(),
]);

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
    case "save_world":
      return saveWorldConfigurationSchema.parse(value);
    case "shutdown":
      return shutdownConfigurationSchema.parse(value);
  }
}
