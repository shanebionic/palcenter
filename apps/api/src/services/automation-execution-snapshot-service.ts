import type { ConnectionRepository } from "../repositories/connection-repository.js";
import type {
  AutomationExecutionSnapshot,
  StoredAutomationTask,
} from "../types/automation.js";
import { automationActionSummary } from "./automation-execution-presentation.js";

export interface AutomationExecutionSnapshotFactory {
  create(task: StoredAutomationTask): Promise<AutomationExecutionSnapshot>;
}

export class AutomationExecutionSnapshotService implements AutomationExecutionSnapshotFactory {
  constructor(private readonly connections: ConnectionRepository) {}

  async create(
    task: StoredAutomationTask,
  ): Promise<AutomationExecutionSnapshot> {
    const connection = await this.connections.get(task.serverId);
    return {
      taskName: task.name,
      taskType: task.taskType,
      serverId: task.serverId,
      serverName: connection?.name ?? "Removed server",
      actionSummary: automationActionSummary(task),
    };
  }
}
