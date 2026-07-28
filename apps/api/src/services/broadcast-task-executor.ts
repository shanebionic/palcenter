import type { StoredAutomationTask } from "../types/automation.js";
import { ServerAdminService } from "./server-admin-service.js";
import type { TaskExecutor } from "./task-executor.js";

export class BroadcastTaskExecutor implements TaskExecutor {
  constructor(private readonly serverAdministration: ServerAdminService) {}

  async execute(task: StoredAutomationTask): Promise<void> {
    await this.serverAdministration.announce(
      task.serverId,
      task.configuration.message,
    );
  }
}
