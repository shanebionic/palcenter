export const automationTaskTypes = ["broadcast_message"] as const;
export type AutomationTaskType = (typeof automationTaskTypes)[number];

export type AutomationSchedule =
  | { type: "every_minutes"; interval: number }
  | { type: "hourly"; minute: number }
  | { type: "daily"; time: string }
  | { type: "weekly"; dayOfWeek: number; time: string }
  | { type: "monthly"; dayOfMonth: number; time: string }
  | { type: "specific_time"; runAt: string }
  | { type: "cron"; expression: string };

export interface BroadcastTaskConfiguration {
  message: string;
}

export type AutomationTaskConfiguration = BroadcastTaskConfiguration;

export type AutomationResult = "running" | "success" | "failure";
export type AutomationTrigger = "scheduled" | "manual";

export interface AutomationTask {
  id: string;
  name: string;
  serverId: string;
  serverName: string;
  enabled: boolean;
  taskType: AutomationTaskType;
  schedule: AutomationSchedule;
  timeZone: string;
  configuration: AutomationTaskConfiguration;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastResult: AutomationResult | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoredAutomationTask extends Omit<
  AutomationTask,
  "serverName"
> {}

export interface AutomationTaskInput {
  name: string;
  serverId: string;
  enabled: boolean;
  taskType: AutomationTaskType;
  schedule: AutomationSchedule;
  timeZone: string;
  configuration: AutomationTaskConfiguration;
}

export interface AutomationExecution {
  id: number;
  taskId: string;
  serverId: string;
  taskType: AutomationTaskType;
  trigger: AutomationTrigger;
  result: AutomationResult;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  errorMessage: string | null;
}

export interface AutomationSummary {
  activeTasks: number;
  disabledTasks: number;
  failedToday: number;
  nextScheduledRun: string | null;
}
