import { randomBytes } from "node:crypto";
import type { ConnectionRepository } from "../repositories/connection-repository.js";
import type { AutomationRepository } from "../repositories/automation-repository.js";
import type {
  AutomationSchedule,
  AutomationExecutionDetail,
  AutomationSummary,
  AutomationTask,
  AutomationTaskInput,
  StoredAutomationTask,
} from "../types/automation.js";
import {
  automationActionSummary,
  automationResultMessage,
} from "./automation-execution-presentation.js";
import { ScheduleCalculator } from "./schedule-calculator.js";

export class AutomationTaskNotFoundError extends Error {
  constructor() {
    super("The requested automation task does not exist.");
  }
}

export class AutomationServerNotFoundError extends Error {
  constructor() {
    super("The selected server does not exist.");
  }
}

export interface AutomationListQuery {
  search?: string;
  serverId?: string;
  taskType?: string;
  enabled?: boolean;
  sortBy?:
    | "name"
    | "server"
    | "taskType"
    | "enabled"
    | "lastRunAt"
    | "nextRunAt"
    | "lastResult";
  order?: "asc" | "desc";
}

export class AutomationService {
  constructor(
    private readonly repository: AutomationRepository,
    private readonly connections: ConnectionRepository,
    private readonly schedules: ScheduleCalculator,
  ) {}

  async list(query: AutomationListQuery = {}): Promise<AutomationTask[]> {
    let tasks = await this.hydrate(this.repository.listTasks());
    const search = query.search?.trim().toLocaleLowerCase();

    if (search) {
      tasks = tasks.filter(
        (task) =>
          task.name.toLocaleLowerCase().includes(search) ||
          task.serverName.toLocaleLowerCase().includes(search),
      );
    }
    if (query.serverId) {
      tasks = tasks.filter((task) => task.serverId === query.serverId);
    }
    if (query.taskType) {
      tasks = tasks.filter((task) => task.taskType === query.taskType);
    }
    if (query.enabled !== undefined) {
      tasks = tasks.filter((task) => task.enabled === query.enabled);
    }

    const sortBy = query.sortBy ?? "nextRunAt";
    const direction = query.order === "desc" ? -1 : 1;
    return tasks.sort(
      (left, right) =>
        this.sortValue(left, sortBy).localeCompare(
          this.sortValue(right, sortBy),
          undefined,
          { numeric: true },
        ) * direction,
    );
  }

  async get(id: string): Promise<AutomationTask> {
    const task = this.repository.getTask(id);
    if (!task) throw new AutomationTaskNotFoundError();
    return (await this.hydrate([task]))[0]!;
  }

  async create(input: AutomationTaskInput): Promise<AutomationTask> {
    await this.requireServer(input.serverId);
    this.schedules.validate(input.schedule, input.timeZone);
    const timestamp = new Date().toISOString();
    const stored: StoredAutomationTask = {
      id: `task_${randomBytes(6).toString("hex")}`,
      ...input,
      nextRunAt: input.enabled
        ? this.schedules.nextRun(input.schedule, input.timeZone, new Date())
        : null,
      lastRunAt: null,
      lastResult: null,
      lastError: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.repository.createTask(stored);
    return this.get(stored.id);
  }

  async update(
    id: string,
    input: AutomationTaskInput,
  ): Promise<AutomationTask> {
    await this.get(id);
    await this.requireServer(input.serverId);
    this.schedules.validate(input.schedule, input.timeZone);
    const nextRunAt = input.enabled
      ? this.schedules.nextRun(input.schedule, input.timeZone, new Date())
      : null;
    this.repository.updateTask(id, input, nextRunAt);
    return this.get(id);
  }

  async setEnabled(id: string, enabled: boolean): Promise<AutomationTask> {
    const task = await this.get(id);
    const input = {
      name: task.name,
      serverId: task.serverId,
      taskType: task.taskType,
      schedule: task.schedule,
      timeZone: task.timeZone,
      configuration: task.configuration,
      enabled,
    } as AutomationTaskInput;
    return this.update(id, input);
  }

  async delete(id: string): Promise<void> {
    await this.get(id);
    this.repository.deleteTask(id);
  }

  async history(
    id: string,
    limit: number,
  ): Promise<AutomationExecutionDetail[]> {
    const task = await this.get(id);
    return this.repository.listExecutions(id, limit).map((execution) => ({
      ...execution,
      taskName: task.name,
      serverName: task.serverName,
      actionSummary: automationActionSummary(task),
      resultMessage: automationResultMessage(task, execution),
    }));
  }

  async summary(): Promise<AutomationSummary> {
    const tasks = this.repository.listTasks();
    const active = tasks.filter((task) => task.enabled);
    const nextRuns = active
      .map((task) => task.nextRunAt)
      .filter((value): value is string => value !== null)
      .sort();
    const today = `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`;

    return {
      activeTasks: active.length,
      disabledTasks: tasks.length - active.length,
      failedToday: this.repository.failedSince(today),
      nextScheduledRun: nextRuns[0] ?? null,
    };
  }

  preview(
    schedule: AutomationSchedule,
    timeZone: string,
  ): { nextRunAt: string | null } {
    return {
      nextRunAt: this.schedules.nextRun(schedule, timeZone, new Date()),
    };
  }

  private async requireServer(id: string): Promise<void> {
    if (!(await this.connections.get(id))) {
      throw new AutomationServerNotFoundError();
    }
  }

  private async hydrate(
    tasks: StoredAutomationTask[],
  ): Promise<AutomationTask[]> {
    const servers = new Map(
      (await this.connections.list()).map((server) => [server.id, server.name]),
    );
    return tasks.map((task) => ({
      ...task,
      serverName: servers.get(task.serverId) ?? "Removed server",
    }));
  }

  private sortValue(
    task: AutomationTask,
    sortBy: NonNullable<AutomationListQuery["sortBy"]>,
  ): string {
    switch (sortBy) {
      case "name":
        return task.name;
      case "server":
        return task.serverName;
      case "taskType":
        return task.taskType;
      case "enabled":
        return task.enabled ? "1" : "0";
      case "lastRunAt":
        return task.lastRunAt ?? "";
      case "nextRunAt":
        return task.nextRunAt ?? "9999";
      case "lastResult":
        return task.lastResult ?? "";
    }
  }
}
