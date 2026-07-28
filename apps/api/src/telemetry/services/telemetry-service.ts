import type { ConnectionRepository } from "../../repositories/connection-repository.js";
import type { PlayerTelemetryCollector } from "../collectors/player-telemetry-collector.js";
import type { TelemetryRepository } from "../repositories/telemetry-repository.js";
import type {
  PlayerPositionSnapshot,
  PlayerTelemetryHistoryQuery,
} from "../types/player-telemetry.js";

export class TelemetryServerNotFoundError extends Error {
  constructor() {
    super("The requested server does not exist.");
    this.name = "TelemetryServerNotFoundError";
  }
}

export type TelemetryCollectionErrorHandler = (
  serverId: string,
  error: unknown,
) => void;

export class TelemetryService {
  private timer: ReturnType<typeof setInterval> | null = null;
  private collectionPromise: Promise<void> | null = null;

  constructor(
    private readonly connections: ConnectionRepository,
    private readonly repository: TelemetryRepository,
    private readonly collector: PlayerTelemetryCollector,
    private readonly intervalMs: number,
    private readonly onError: TelemetryCollectionErrorHandler,
  ) {}

  start(collectImmediately = true): void {
    if (this.timer) {
      return;
    }

    const run = () => {
      if (this.collectionPromise) {
        return;
      }

      this.collectionPromise = this.collectAll().finally(() => {
        this.collectionPromise = null;
      });
    };

    if (collectImmediately) {
      run();
    }
    this.timer = setInterval(run, this.intervalMs);
    this.timer.unref();
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await this.collectionPromise;
  }

  async collectAll(): Promise<void> {
    const connections = await this.connections.list();
    await Promise.all(
      connections.map(async (connection) => {
        try {
          const snapshots = await this.collector.collect(connection);
          this.repository.insertPlayerSnapshots(snapshots);
        } catch (error) {
          this.onError(connection.id, error);
        }
      }),
    );
  }

  async latest(serverId: string): Promise<PlayerPositionSnapshot[]> {
    await this.requireServer(serverId);
    return this.repository.latestPlayerSnapshots(serverId);
  }

  async history(
    serverId: string,
    playerId: string,
    query: PlayerTelemetryHistoryQuery,
  ): Promise<PlayerPositionSnapshot[]> {
    await this.requireServer(serverId);
    return this.repository.playerHistory(serverId, playerId, query);
  }

  private async requireServer(serverId: string): Promise<void> {
    if (!(await this.connections.get(serverId))) {
      throw new TelemetryServerNotFoundError();
    }
  }
}
