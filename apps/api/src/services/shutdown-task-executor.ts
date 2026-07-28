import type { StoredAutomationTask } from "../types/automation.js";
import { ServerAdminService } from "./server-admin-service.js";
import type { TaskExecutor } from "./task-executor.js";

export class ShutdownTaskExecutor implements TaskExecutor<"shutdown"> {
  constructor(
    private readonly serverAdministration: Pick<ServerAdminService, "shutdown">,
  ) {}

  async execute(
    task: Extract<StoredAutomationTask, { taskType: "shutdown" }>,
  ): Promise<void> {
    await this.serverAdministration.shutdown(
      task.serverId,
      task.configuration.waitTime,
      task.configuration.message || undefined,
    );
  }
}
