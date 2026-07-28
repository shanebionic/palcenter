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

export interface AutomationTaskConfigurationByType {
  broadcast_message: { message: string };
  save_world: Record<string, never>;
  shutdown: { waitTime: number; message?: string };
}

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

interface AutomationTaskFields extends AutomationTaskInputFields {
  id: string;
  serverName: string;
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastResult: "running" | "success" | "failure" | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AutomationTask = {
  [TaskType in AutomationTaskType]: AutomationTaskFields & {
    taskType: TaskType;
    configuration: AutomationTaskConfigurationByType[TaskType];
  };
}[AutomationTaskType];

export interface AutomationSummary {
  activeTasks: number;
  disabledTasks: number;
  failedToday: number;
  nextScheduledRun: string | null;
}

export interface AutomationExecution {
  id: number;
  taskId: string;
  serverId: string;
  taskType: AutomationTaskType;
  trigger: "scheduled" | "manual";
  result: "running" | "success" | "failure";
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  errorMessage: string | null;
}

export interface AutomationListQuery {
  search?: string;
  serverId?: string;
  taskType?: AutomationTaskType;
  enabled?: boolean;
  sortBy?:
    | "name"
    | "server"
    | "taskType"
    | "enabled"
    | "lastRunAt"
    | "nextRunAt"
    | "lastResult";
  order?: "asc" | "desc";
}
