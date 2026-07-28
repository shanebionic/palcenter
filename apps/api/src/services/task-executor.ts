import type {
  AutomationTaskType,
  StoredAutomationTask,
} from "../types/automation.js";

export interface TaskExecutor<TaskType extends AutomationTaskType> {
  execute(
    task: Extract<StoredAutomationTask, { taskType: TaskType }>,
  ): Promise<void>;
}
