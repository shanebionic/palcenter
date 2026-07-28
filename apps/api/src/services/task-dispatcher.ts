import type { StoredAutomationTask } from "../types/automation.js";
import type { TaskExecutor } from "./task-executor.js";

export interface TaskExecutorRegistry {
  broadcast_message: TaskExecutor<"broadcast_message">;
  save_world: TaskExecutor<"save_world">;
  shutdown: TaskExecutor<"shutdown">;
}

export class TaskDispatcher {
  constructor(private readonly executors: TaskExecutorRegistry) {}

  async execute(task: StoredAutomationTask): Promise<void> {
    switch (task.taskType) {
      case "broadcast_message":
        return this.executors.broadcast_message.execute(task);
      case "save_world":
        return this.executors.save_world.execute(task);
      case "shutdown":
        return this.executors.shutdown.execute(task);
    }
  }
}
