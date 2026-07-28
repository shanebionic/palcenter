import type {
  AutomationExecution,
  AutomationExecutionSnapshot,
  AutomationResult,
  AutomationTaskInput,
  AutomationTrigger,
  StoredAutomationTask,
} from "../types/automation.js";

export interface AutomationRepository {
  initialize(): void;
  close(): void;
  reopen(): void;
  listTasks(): StoredAutomationTask[];
  getTask(id: string): StoredAutomationTask | null;
  createTask(task: StoredAutomationTask): void;
  updateTask(
    id: string,
    input: AutomationTaskInput,
    nextRunAt: string | null,
  ): void;
  deleteTask(id: string): void;
  dueTasks(now: string): StoredAutomationTask[];
  beginExecution(
    task: StoredAutomationTask,
    snapshot: AutomationExecutionSnapshot,
    trigger: AutomationTrigger,
    startedAt: string,
    nextRunAt: string | null,
    enabled: boolean,
  ): number;
  completeExecution(
    executionId: number,
    taskId: string,
    result: Exclude<AutomationResult, "running">,
    finishedAt: string,
    durationMs: number,
    errorMessage: string | null,
  ): void;
  listExecutions(taskId: string, limit: number): AutomationExecution[];
  failedSince(since: string): number;
}
