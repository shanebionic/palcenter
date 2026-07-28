import type { AutomationRepository } from "../repositories/automation-repository.js";
import type {
  AutomationExecution,
  AutomationTrigger,
} from "../types/automation.js";
import { AutomationTaskNotFoundError } from "./automation-service.js";
import { ScheduleCalculator } from "./schedule-calculator.js";
import { TaskDispatcher } from "./task-dispatcher.js";

export class SchedulerService {
  private timer: ReturnType<typeof setInterval> | null = null;
  private ticking = false;
  private readonly running = new Set<string>();
  private readonly activeRuns = new Set<Promise<AutomationExecution>>();

  constructor(
    private readonly repository: AutomationRepository,
    private readonly schedules: ScheduleCalculator,
    private readonly dispatcher: TaskDispatcher,
    private readonly intervalMs: number,
    private readonly onError: (error: unknown) => void,
  ) {}

  start(): void {
    if (this.timer) return;
    void this.tick().catch(this.onError);
    this.timer = setInterval(
      () => void this.tick().catch(this.onError),
      this.intervalMs,
    );
    this.timer.unref();
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await Promise.allSettled(this.activeRuns);
  }

  async runNow(taskId: string): Promise<AutomationExecution> {
    return this.trackedRun(taskId, "manual");
  }

  async tick(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;

    try {
      const due = this.repository.dueTasks(new Date().toISOString());
      await Promise.all(
        due.map((task) =>
          this.trackedRun(task.id, "scheduled").catch(this.onError),
        ),
      );
    } finally {
      this.ticking = false;
    }
  }

  private trackedRun(
    taskId: string,
    trigger: AutomationTrigger,
  ): Promise<AutomationExecution> {
    const promise = this.run(taskId, trigger);
    this.activeRuns.add(promise);
    void promise.then(
      () => this.activeRuns.delete(promise),
      () => this.activeRuns.delete(promise),
    );
    return promise;
  }

  private async run(
    taskId: string,
    trigger: AutomationTrigger,
  ): Promise<AutomationExecution> {
    const task = this.repository.getTask(taskId);
    if (!task) throw new AutomationTaskNotFoundError();
    if (this.running.has(taskId)) {
      throw new Error("This automation task is already running.");
    }

    this.running.add(taskId);

    try {
      const started = new Date();
      const nextRunAt =
        trigger === "scheduled"
          ? this.schedules.nextRun(task.schedule, task.timeZone, started)
          : task.nextRunAt;
      const enabled =
        trigger === "scheduled" ? nextRunAt !== null : task.enabled;
      const executionId = this.repository.beginExecution(
        task,
        trigger,
        started.toISOString(),
        nextRunAt,
        enabled,
      );
      let result: "success" | "failure" = "success";
      let errorMessage: string | null = null;

      try {
        await this.dispatcher.execute(task);
      } catch (error) {
        result = "failure";
        errorMessage =
          error instanceof Error ? error.message : "Task execution failed.";
      }

      const finished = new Date();
      this.repository.completeExecution(
        executionId,
        taskId,
        result,
        finished.toISOString(),
        Math.max(0, finished.getTime() - started.getTime()),
        errorMessage,
      );
      return this.repository.listExecutions(taskId, 1)[0]!;
    } finally {
      this.running.delete(taskId);
    }
  }
}
