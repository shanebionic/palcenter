import type { ConnectionRepository } from "../repositories/connection-repository.js";
import type {
  HistoryRepository,
  NewServerEvent,
} from "../repositories/history-repository.js";
import type {
  ConnectedPlayer,
  ObservedPlayer,
  ServerEvent,
  ServerMetric,
  ServerStatus,
} from "../types/connections.js";
import { PlayerService } from "./player-service.js";
import { ServerStatusService } from "./server-status-service.js";

export class HistoryServerNotFoundError extends Error {}

export class ServerHistoryService {
  private timer: ReturnType<typeof setInterval> | null = null;
  private collectionPromise: Promise<void> | null = null;
  private collecting = false;

  constructor(
    private readonly connections: ConnectionRepository,
    private readonly history: HistoryRepository,
    private readonly statuses: ServerStatusService,
    private readonly players: PlayerService,
    private readonly intervalMs: number,
    private readonly onEvents: (events: ServerEvent[]) => Promise<void>,
  ) {}

  start(onError: (error: unknown) => void): void {
    const run = () => {
      if (this.collectionPromise) {
        return;
      }

      this.collectionPromise = this.collect()
        .catch(onError)
        .finally(() => {
          this.collectionPromise = null;
        });
    };

    run();
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

  async metrics(serverId: string, limit: number): Promise<ServerMetric[]> {
    await this.requireServer(serverId);
    return this.history.listMetrics(serverId, limit);
  }

  async events(serverId: string, limit: number): Promise<ServerEvent[]> {
    await this.requireServer(serverId);
    return this.history.listEvents(serverId, limit);
  }

  async collect(): Promise<void> {
    if (this.collecting) {
      return;
    }

    this.collecting = true;

    try {
      const statuses = await this.statuses.list();
      await Promise.all(statuses.map((status) => this.capture(status)));
    } finally {
      this.collecting = false;
    }
  }

  private async capture(status: ServerStatus): Promise<void> {
    const previousMetric = this.history.latestMetric(status.id);
    const previousPlayers = this.history.activePlayers(status.id);
    const currentPlayers =
      status.status === "online" ? await this.safePlayers(status.id) : [];
    const capturedAt = status.lastUpdated;

    const events = this.statusEvents(status, previousMetric, capturedAt);
    events.push(
      ...this.playerEvents(
        status,
        previousMetric,
        previousPlayers,
        currentPlayers,
        capturedAt,
      ),
    );

    const persistedEvents = this.history.saveSample(
      {
        serverId: status.id,
        status: status.status,
        playerCount: status.players,
        maxPlayers: status.maxPlayers,
        fps: status.fps,
        responseTimeMs: status.responseTimeMs,
        uptimeSeconds: status.uptimeSeconds,
        capturedAt,
      },
      events,
      currentPlayers,
    );

    if (persistedEvents.length > 0) {
      await this.onEvents(persistedEvents);
    }
  }

  private statusEvents(
    status: ServerStatus,
    previous: ServerMetric | null,
    occurredAt: string,
  ): NewServerEvent[] {
    if (!previous) {
      return [];
    }

    const events: NewServerEvent[] = [];

    if (previous.status !== status.status) {
      events.push(
        this.event(
          status.id,
          status.status === "online" ? "server_online" : "server_offline",
          occurredAt,
        ),
      );
    }

    if (
      previous.status === "online" &&
      status.status === "online" &&
      previous.uptimeSeconds !== null &&
      status.uptimeSeconds !== null &&
      status.uptimeSeconds < previous.uptimeSeconds
    ) {
      events.push(this.event(status.id, "server_restarted", occurredAt));
    }

    return events;
  }

  private playerEvents(
    status: ServerStatus,
    previousMetric: ServerMetric | null,
    previousPlayers: ObservedPlayer[],
    currentPlayers: ObservedPlayer[],
    occurredAt: string,
  ): NewServerEvent[] {
    if (status.status !== "online" || previousMetric?.status !== "online") {
      return [];
    }

    const previousById = new Map(
      previousPlayers.map((player) => [player.playerId, player]),
    );
    const currentById = new Map(
      currentPlayers.map((player) => [player.playerId, player]),
    );
    const events: NewServerEvent[] = [];

    for (const player of currentPlayers) {
      if (!previousById.has(player.playerId)) {
        events.push(
          this.event(
            status.id,
            "player_joined",
            occurredAt,
            player.playerId,
            player.name,
          ),
        );
      }
    }

    for (const player of previousPlayers) {
      if (!currentById.has(player.playerId)) {
        events.push(
          this.event(
            status.id,
            "player_left",
            occurredAt,
            player.playerId,
            player.name,
          ),
        );
      }
    }

    return events;
  }

  private event(
    serverId: string,
    type: NewServerEvent["type"],
    occurredAt: string,
    playerId: string | null = null,
    playerName: string | null = null,
  ): NewServerEvent {
    return { serverId, type, playerId, playerName, occurredAt };
  }

  private async safePlayers(serverId: string): Promise<ObservedPlayer[]> {
    try {
      return (await this.players.list(serverId)).map(
        (player: ConnectedPlayer) => ({
          playerId: player.userId,
          name: player.name,
        }),
      );
    } catch {
      return this.history.activePlayers(serverId);
    }
  }

  private async requireServer(serverId: string): Promise<void> {
    if (!(await this.connections.get(serverId))) {
      throw new HistoryServerNotFoundError(
        "The requested server does not exist.",
      );
    }
  }
}
