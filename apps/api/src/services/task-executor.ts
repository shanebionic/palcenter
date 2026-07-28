import type { StoredAutomationTask } from "../types/automation.js";

export interface TaskExecutor {
  execute(task: StoredAutomationTask): Promise<void>;
}
