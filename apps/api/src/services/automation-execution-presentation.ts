import type {
  AutomationExecution,
  StoredAutomationTask,
} from "../types/automation.js";

export function automationActionSummary(task: StoredAutomationTask): string {
  switch (task.taskType) {
    case "broadcast_message":
      return `Broadcast message: ${truncate(task.configuration.message, 120)}`;
    case "save_world":
      return "Save the current world state";
    case "shutdown": {
      const message = task.configuration.message?.trim();
      const wait = `Graceful shutdown after ${task.configuration.waitTime} seconds`;
      return message ? `${wait}: ${truncate(message, 120)}` : wait;
    }
  }
}

export function automationResultMessage(
  task: StoredAutomationTask,
  execution: AutomationExecution,
): string {
  if (execution.result === "failure") {
    return execution.errorMessage ?? "The automation task failed.";
  }
  if (execution.result === "running") return "The task is currently running.";

  switch (task.taskType) {
    case "broadcast_message":
      return "Broadcast message sent successfully.";
    case "save_world":
      return "World save completed successfully.";
    case "shutdown":
      return "Graceful shutdown request sent successfully.";
  }
}

function truncate(value: string, limit: number): string {
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
}
