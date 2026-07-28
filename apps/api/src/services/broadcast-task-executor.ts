import type { StoredAutomationTask } from "../types/automation.js";
import { ServerAdminService } from "./server-admin-service.js";
import type { TaskExecutor } from "./task-executor.js";

export class BroadcastTaskExecutor implements TaskExecutor<"broadcast_message"> {
  constructor(
    private readonly serverAdministration: Pick<ServerAdminService, "announce">,
  ) {}

  async execute(
    task: Extract<StoredAutomationTask, { taskType: "broadcast_message" }>,
  ): Promise<void> {
    await this.serverAdministration.announce(
      task.serverId,
      task.configuration.message,
    );
  }
}
