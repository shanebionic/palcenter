export const automationTaskTypes = [
  "broadcast_message",
  "save_world",
  "shutdown",
] as const;
export type AutomationTaskType = (typeof automationTaskTypes)[number];

export type AutomationSchedule =
  | { type: "every_minutes"; interval: number; startMinute: number }
  | { type: "hourly"; minute: number }
  | { type: "daily"; time: string }
  | { type: "weekly"; dayOfWeek: number; time: string }
  | { type: "monthly"; dayOfMonth: number; time: string }
  | { type: "specific_time"; runAt: string }
  | { type: "cron"; expression: string };

export interface BroadcastTaskConfiguration {
  message: string;
}

export type SaveWorldTaskConfiguration = Record<string, never>;

export interface ShutdownTaskConfiguration {
  waitTime: number;
  message?: string;
}

export interface AutomationTaskConfigurationByType {
  broadcast_message: BroadcastTaskConfiguration;
  save_world: SaveWorldTaskConfiguration;
  shutdown: ShutdownTaskConfiguration;
}

export type AutomationTaskConfiguration =
  AutomationTaskConfigurationByType[AutomationTaskType];

export type AutomationResult = "running" | "success" | "failure";
export type AutomationTrigger = "scheduled" | "manual";

export interface AutomationExecutionSnapshot {
  taskName: string;
  taskType: AutomationTaskType;
  serverId: string;
  serverName: string;
  actionSummary: string;
}

interface AutomationTaskFields {
  id: string;
  name: string;
  serverId: string;
  enabled: boolean;
  schedule: AutomationSchedule;
  timeZone: string;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastResult: AutomationResult | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export type StoredAutomationTask = {
  [TaskType in AutomationTaskType]: AutomationTaskFields & {
    taskType: TaskType;
    configuration: AutomationTaskConfigurationByType[TaskType];
  };
}[AutomationTaskType];

export type AutomationTask = StoredAutomationTask & { serverName: string };

interface AutomationTaskInputFields {
  name: string;
  serverId: string;
  enabled: boolean;
  schedule: AutomationSchedule;
  timeZone: string;
}

export type AutomationTaskInput = {
  [TaskType in AutomationTaskType]: AutomationTaskInputFields & {
    taskType: TaskType;
    configuration: AutomationTaskConfigurationByType[TaskType];
  };
}[AutomationTaskType];

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
  snapshot: AutomationExecutionSnapshot | null;
}

export interface AutomationExecutionDetail extends Omit<
  AutomationExecution,
  "snapshot"
> {
  taskName: string;
  serverName: string;
  actionSummary: string;
  resultMessage: string;
  metadataSource: "snapshot" | "legacy_current_task";
}

export interface AutomationSummary {
  activeTasks: number;
  disabledTasks: number;
  failedToday: number;
  nextScheduledRun: string | null;
}
