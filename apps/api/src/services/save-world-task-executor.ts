import type { StoredAutomationTask } from "../types/automation.js";
import { ServerAdminService } from "./server-admin-service.js";
import type { TaskExecutor } from "./task-executor.js";

export class SaveWorldTaskExecutor implements TaskExecutor<"save_world"> {
  constructor(
    private readonly serverAdministration: Pick<
      ServerAdminService,
      "saveWorld"
    >,
  ) {}

  async execute(
    task: Extract<StoredAutomationTask, { taskType: "save_world" }>,
  ): Promise<void> {
    await this.serverAdministration.saveWorld(task.serverId);
  }
}
