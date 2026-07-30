import type { ConnectionRepository } from "../../repositories/connection-repository.js";
import type { PlayerTelemetryCollector } from "../collectors/player-telemetry-collector.js";
import type { TelemetryRepository } from "../repositories/telemetry-repository.js";
import type {
  NewPlayerPositionSnapshot,
  PlayerPositionSnapshot,
  PlayerTelemetryHistoryQuery,
  PlayerTrailPoint,
} from "../types/player-telemetry.js";

export const telemetryHeartbeatMs = 5 * 60 * 1_000;
export const telemetryCleanupIntervalMs = 5 * 60 * 1_000;
export const telemetryCleanupBatchSize = 1_000;
export const telemetryMovementThreshold = 100;
export const telemetryPingThreshold = 25;

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
  private lastCleanupAt: number | null = null;
  private readonly lastSuccessfulCollections = new Map<string, string>();

  constructor(
    private readonly connections: ConnectionRepository,
    private readonly repository: TelemetryRepository,
    private readonly collector: PlayerTelemetryCollector,
    private readonly intervalMs: number,
    private readonly retentionDays: number,
    private readonly onError: TelemetryCollectionErrorHandler,
    private readonly now: () => Date = () => new Date(),
  ) {}

  start(collectImmediately = true): void {
    if (this.timer) {
      return;
    }

    const run = () => {
      if (this.collectionPromise) {
        return;
      }

      this.collectionPromise = this.collectAll()
        .catch((error) => this.onError("collection", error))
        .finally(() => {
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
    const collectionTime = this.now();
    const capturedAt = collectionTime.toISOString();
    await Promise.all(
      connections.map(async (connection) => {
        try {
          const snapshots = await this.collector.collect(
            connection,
            capturedAt,
          );
          const previous = new Map(
            this.repository
              .latestPlayerSnapshots(connection.id)
              .map((snapshot) => [snapshot.userId, snapshot]),
          );
          this.repository.insertPlayerSnapshots(
            snapshots.filter((snapshot) =>
              this.shouldStore(snapshot, previous.get(snapshot.userId)),
            ),
          );
          this.lastSuccessfulCollections.set(connection.id, capturedAt);
        } catch (error) {
          this.onError(connection.id, error);
        }
      }),
    );
    this.cleanupExpired(collectionTime.getTime());
  }

  async latest(serverId: string): Promise<PlayerPositionSnapshot[]> {
    await this.requireServer(serverId);
    return this.repository.latestPlayerSnapshots(serverId);
  }

  lastCollectedAt(serverId: string): string | null {
    return this.lastSuccessfulCollections.get(serverId) ?? null;
  }

  async history(
    serverId: string,
    userId: string,
    query: PlayerTelemetryHistoryQuery,
  ): Promise<PlayerPositionSnapshot[]> {
    await this.requireServer(serverId);
    return this.repository.playerHistory(serverId, userId, query);
  }

  async trailHistory(
    serverId: string,
    userId: string,
    query: PlayerTelemetryHistoryQuery,
  ): Promise<{ points: PlayerTrailPoint[]; truncated: boolean }> {
    const snapshots = await this.history(serverId, userId, {
      ...query,
      limit: query.limit + 1,
    });
    const truncated = snapshots.length > query.limit;
    const points = snapshots
      .slice(truncated ? 1 : 0)
      .map(({ capturedAt, x, y }) => ({ capturedAt, x, y }));
    return { points, truncated };
  }

  private shouldStore(
    current: NewPlayerPositionSnapshot,
    previous: PlayerPositionSnapshot | undefined,
  ): boolean {
    if (!previous) {
      return true;
    }

    if (
      current.playerId !== previous.playerId ||
      current.playerName !== previous.playerName ||
      current.accountName !== previous.accountName ||
      current.level !== previous.level ||
      current.buildingCount !== previous.buildingCount ||
      current.guildId !== previous.guildId ||
      current.guildName !== previous.guildName ||
      this.materialPingChange(current.ping, previous.ping) ||
      this.materialMovement(current, previous)
    ) {
      return true;
    }

    return (
      Date.parse(current.capturedAt) - Date.parse(previous.capturedAt) >=
      telemetryHeartbeatMs
    );
  }

  private materialMovement(
    current: NewPlayerPositionSnapshot,
    previous: PlayerPositionSnapshot,
  ): boolean {
    const pairs = [
      [current.x, previous.x],
      [current.y, previous.y],
      [current.z, previous.z],
    ] as const;

    if (pairs.some(([next, last]) => (next === null) !== (last === null))) {
      return true;
    }

    const squaredDistance = pairs.reduce((total, [next, last]) => {
      if (next === null || last === null) {
        return total;
      }
      return total + (next - last) ** 2;
    }, 0);

    return squaredDistance >= telemetryMovementThreshold ** 2;
  }

  private materialPingChange(
    current: number | null,
    previous: number | null,
  ): boolean {
    if ((current === null) !== (previous === null)) {
      return true;
    }
    return (
      current !== null &&
      previous !== null &&
      Math.abs(current - previous) >= telemetryPingThreshold
    );
  }

  private cleanupExpired(now: number): void {
    if (
      this.lastCleanupAt !== null &&
      now - this.lastCleanupAt < telemetryCleanupIntervalMs
    ) {
      return;
    }

    this.lastCleanupAt = now;
    const cutoff = new Date(
      now - this.retentionDays * 24 * 60 * 60 * 1_000,
    ).toISOString();

    try {
      this.repository.deleteExpiredPlayerSnapshots(
        cutoff,
        telemetryCleanupBatchSize,
      );
    } catch (error) {
      this.onError("retention_cleanup", error);
    }
  }

  private async requireServer(serverId: string): Promise<void> {
    if (!(await this.connections.get(serverId))) {
      throw new TelemetryServerNotFoundError();
    }
  }
}
