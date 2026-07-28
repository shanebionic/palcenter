import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  parseTaskConfiguration,
  storedAutomationScheduleSchema,
} from "../services/automation-validation.js";
import {
  tightenFilePermissionsSync,
  type StoragePermissionWarningHandler,
} from "../services/storage-initialization-service.js";
import {
  automationTaskTypes,
  type AutomationExecution,
  type AutomationResult,
  type AutomationTaskInput,
  type AutomationTaskType,
  type AutomationTrigger,
  type StoredAutomationTask,
} from "../types/automation.js";
import type { AutomationRepository } from "./automation-repository.js";

interface TaskRow {
  id: string;
  name: string;
  server_id: string;
  enabled: number;
  task_type: string;
  schedule_json: string;
  time_zone: string;
  configuration_json: string;
  last_run_at: string | null;
  next_run_at: string | null;
  last_result: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

interface ExecutionRow {
  id: number;
  task_id: string;
  server_id: string;
  task_type: string;
  trigger: string;
  result: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  error_message: string | null;
}

export class SqliteAutomationRepository implements AutomationRepository {
  private database: DatabaseSync | null = null;
  private readonly databasePath: string;

  constructor(
    configDirectory: string,
    private readonly onPermissionWarning: StoragePermissionWarningHandler = () =>
      undefined,
  ) {
    const directory = path.resolve(configDirectory);
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    this.databasePath = path.join(directory, "history.sqlite");
    this.open();
  }

  initialize(): void {
    const database = this.requireDatabase();
    database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA busy_timeout = 5000;
      PRAGMA foreign_keys = ON;
    `);
    database.prepare("SELECT 1 FROM scheduled_tasks LIMIT 1").get();
    database.prepare("SELECT 1 FROM task_executions LIMIT 1").get();
  }

  close(): void {
    this.database?.close();
    this.database = null;
  }

  reopen(): void {
    if (this.database) {
      return;
    }

    this.open();
    try {
      this.initialize();
    } catch (error) {
      this.close();
      throw error;
    }
  }

  listTasks(): StoredAutomationTask[] {
    const rows = this.requireDatabase()
      .prepare("SELECT * FROM scheduled_tasks ORDER BY created_at DESC")
      .all() as unknown as TaskRow[];
    return rows.map((row) => this.task(row));
  }

  getTask(id: string): StoredAutomationTask | null {
    const row = this.requireDatabase()
      .prepare("SELECT * FROM scheduled_tasks WHERE id = ?")
      .get(id) as TaskRow | undefined;
    return row ? this.task(row) : null;
  }

  createTask(task: StoredAutomationTask): void {
    this.requireDatabase()
      .prepare(
        `INSERT INTO scheduled_tasks (
          id, name, server_id, enabled, task_type, schedule_json, time_zone,
          configuration_json, last_run_at, next_run_at, last_result,
          last_error, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        task.id,
        task.name,
        task.serverId,
        task.enabled ? 1 : 0,
        task.taskType,
        JSON.stringify(task.schedule),
        task.timeZone,
        JSON.stringify(task.configuration),
        task.lastRunAt,
        task.nextRunAt,
        task.lastResult,
        task.lastError,
        task.createdAt,
        task.updatedAt,
      );
  }

  updateTask(
    id: string,
    input: AutomationTaskInput,
    nextRunAt: string | null,
  ): void {
    this.requireDatabase()
      .prepare(
        `UPDATE scheduled_tasks SET
          name = ?, server_id = ?, enabled = ?, task_type = ?,
          schedule_json = ?, time_zone = ?, configuration_json = ?,
          next_run_at = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        input.name,
        input.serverId,
        input.enabled ? 1 : 0,
        input.taskType,
        JSON.stringify(input.schedule),
        input.timeZone,
        JSON.stringify(input.configuration),
        nextRunAt,
        new Date().toISOString(),
        id,
      );
  }

  deleteTask(id: string): void {
    this.requireDatabase()
      .prepare("DELETE FROM scheduled_tasks WHERE id = ?")
      .run(id);
  }

  dueTasks(now: string): StoredAutomationTask[] {
    const rows = this.requireDatabase()
      .prepare(
        `SELECT * FROM scheduled_tasks
         WHERE enabled = 1 AND next_run_at IS NOT NULL AND next_run_at <= ?
         ORDER BY next_run_at ASC`,
      )
      .all(now) as unknown as TaskRow[];
    return rows.map((row) => this.task(row));
  }

  beginExecution(
    task: StoredAutomationTask,
    trigger: AutomationTrigger,
    startedAt: string,
    nextRunAt: string | null,
    enabled: boolean,
  ): number {
    const database = this.requireDatabase();
    database.exec("BEGIN IMMEDIATE");

    try {
      const result = database
        .prepare(
          `INSERT INTO task_executions (
            task_id, server_id, task_type, trigger, result, started_at
          ) VALUES (?, ?, ?, ?, 'running', ?)`,
        )
        .run(task.id, task.serverId, task.taskType, trigger, startedAt);
      database
        .prepare(
          `UPDATE scheduled_tasks
           SET enabled = ?, last_run_at = ?, next_run_at = ?, last_result = 'running',
               last_error = NULL, updated_at = ?
           WHERE id = ?`,
        )
        .run(enabled ? 1 : 0, startedAt, nextRunAt, startedAt, task.id);
      database.exec("COMMIT");
      return Number(result.lastInsertRowid);
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }

  completeExecution(
    executionId: number,
    taskId: string,
    result: Exclude<AutomationResult, "running">,
    finishedAt: string,
    durationMs: number,
    errorMessage: string | null,
  ): void {
    const database = this.requireDatabase();
    database.exec("BEGIN IMMEDIATE");

    try {
      database
        .prepare(
          `UPDATE task_executions
           SET result = ?, finished_at = ?, duration_ms = ?, error_message = ?
           WHERE id = ?`,
        )
        .run(result, finishedAt, durationMs, errorMessage, executionId);
      database
        .prepare(
          `UPDATE scheduled_tasks
           SET last_result = ?, last_error = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(result, errorMessage, finishedAt, taskId);
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }

  listExecutions(taskId: string, limit: number): AutomationExecution[] {
    const rows = this.requireDatabase()
      .prepare(
        `SELECT * FROM task_executions
         WHERE task_id = ?
         ORDER BY started_at DESC, id DESC
         LIMIT ?`,
      )
      .all(taskId, limit) as unknown as ExecutionRow[];
    return rows.map((row) => this.execution(row));
  }

  failedSince(since: string): number {
    const row = this.requireDatabase()
      .prepare(
        `SELECT COUNT(*) AS count FROM task_executions
         WHERE result = 'failure' AND started_at >= ?`,
      )
      .get(since) as { count: number };
    return row.count;
  }

  private task(row: TaskRow): StoredAutomationTask {
    const taskType = this.taskType(row.task_type);
    const result =
      row.last_result === null ? null : this.result(row.last_result);

    return {
      id: row.id,
      name: row.name,
      serverId: row.server_id,
      enabled: row.enabled === 1,
      taskType,
      schedule: storedAutomationScheduleSchema.parse(
        JSON.parse(row.schedule_json),
      ),
      timeZone: row.time_zone,
      configuration: parseTaskConfiguration(
        taskType,
        JSON.parse(row.configuration_json),
      ),
      lastRunAt: row.last_run_at,
      nextRunAt: row.next_run_at,
      lastResult: result,
      lastError: row.last_error,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private execution(row: ExecutionRow): AutomationExecution {
    if (row.trigger !== "scheduled" && row.trigger !== "manual") {
      throw new Error(`Unknown automation trigger "${row.trigger}".`);
    }

    return {
      id: row.id,
      taskId: row.task_id,
      serverId: row.server_id,
      taskType: this.taskType(row.task_type),
      trigger: row.trigger,
      result: this.result(row.result),
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      durationMs: row.duration_ms,
      errorMessage: row.error_message,
    };
  }

  private taskType(value: string): AutomationTaskType {
    if (!automationTaskTypes.includes(value as AutomationTaskType)) {
      throw new Error(`Unknown automation task type "${value}".`);
    }
    return value as AutomationTaskType;
  }

  private result(value: string): AutomationResult {
    if (!["running", "success", "failure"].includes(value)) {
      throw new Error(`Unknown automation result "${value}".`);
    }
    return value as AutomationResult;
  }

  private open(): void {
    this.database = new DatabaseSync(this.databasePath);
    tightenFilePermissionsSync(this.databasePath, this.onPermissionWarning);
  }

  private requireDatabase(): DatabaseSync {
    if (!this.database) {
      throw new Error("history.sqlite is closed.");
    }
    return this.database;
  }
}
