import type {
  AutomationTaskType,
  StoredAutomationTask,
} from "../types/automation.js";
import type { TaskExecutor } from "./task-executor.js";

export class TaskDispatcher {
  constructor(
    private readonly executors: ReadonlyMap<AutomationTaskType, TaskExecutor>,
  ) {}

  async execute(task: StoredAutomationTask): Promise<void> {
    const executor = this.executors.get(task.taskType);

    if (!executor) {
      throw new Error(`No executor is registered for "${task.taskType}".`);
    }

    await executor.execute(task);
  }
}
