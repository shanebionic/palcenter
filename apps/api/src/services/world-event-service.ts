import { createHash } from "node:crypto";
import type { ConnectionRepository } from "../repositories/connection-repository.js";
import type { WorldEventRepository } from "../repositories/world-event-repository.js";
import type { CompanionDiscoveryService } from "./companion-discovery-service.js";
import type { CompanionPlayerActivity } from "../types/companion.js";
import type { ServerEvent } from "../types/connections.js";
import type {
  NewWorldEvent,
  WorldEvent,
  WorldEventEvidence,
  WorldEventQuery,
  WorldEventType,
} from "../types/world-events.js";

export class WorldEventServerNotFoundError extends Error {
  constructor() {
    super("The requested server does not exist.");
    this.name = "WorldEventServerNotFoundError";
  }
}

export class WorldEventService {
  constructor(
    private readonly connections: ConnectionRepository,
    private readonly repository: WorldEventRepository,
    private readonly companion?: Pick<CompanionDiscoveryService, "activity">,
  ) {}

  recordServerEvents(events: ServerEvent[]): WorldEvent[] {
    return this.repository.append(
      events.flatMap((event) => this.fromServerEvent(event)),
    );
  }

  async list(serverId: string, query: WorldEventQuery): Promise<WorldEvent[]> {
    if (!(await this.connections.get(serverId))) {
      throw new WorldEventServerNotFoundError();
    }
    await this.syncCompanion(serverId);
    return this.reconcile(this.repository.list(serverId, query));
  }

  async syncCompanion(serverId: string): Promise<void> {
    if (!this.companion) return;
    const activity = await this.companion.activity(serverId, { limit: 200 });
    this.repository.append(
      activity.flatMap((item) => this.fromCompanion(serverId, item)),
    );
  }

  private fromCompanion(
    serverId: string,
    activity: CompanionPlayerActivity,
  ): NewWorldEvent[] {
    const userId = activity.player.userId ?? activity.player.playerId;
    if (!userId) return [];
    const type: WorldEventType =
      activity.eventType === "player_left"
        ? "player_disconnected"
        : activity.eventType;
    return [
      {
        id: `companion_${activity.eventId}`,
        serverId,
        userId,
        playerId: activity.player.playerId,
        timestamp: activity.timestamp,
        type,
        metadata: {
          playerName: activity.player.name,
          sessionId: activity.sessionId,
          activitySource: "companion",
          ...(activity.durationSeconds !== null
            ? { durationSeconds: activity.durationSeconds }
            : {}),
          ...(activity.eventType === "player_left"
            ? { departureKind: "left" }
            : {}),
        },
        confidence: 1,
        evidence: [
          { source: "companion", fact: "server_hook", value: activity.source },
        ],
        position: null,
      },
    ];
  }

  private reconcile(events: WorldEvent[]): WorldEvent[] {
    const exact = events.filter(
      (event) => event.metadata.activitySource === "companion",
    );
    if (exact.length === 0) return events;
    return events.filter((event) => {
      if (event.metadata.activitySource === "companion") return true;
      return !exact.some(
        (candidate) =>
          candidate.userId === event.userId &&
          candidate.type === event.type &&
          Math.abs(
            Date.parse(candidate.timestamp) - Date.parse(event.timestamp),
          ) <= 60_000,
      );
    });
  }

  private fromServerEvent(event: ServerEvent): NewWorldEvent[] {
    if (!event.playerId) return [];
    if (event.type === "player_joined") {
      const evidence = this.evidence("appeared");
      return [
        this.event(event, "player_joined", evidence),
        this.event(event, "session_started", evidence),
      ];
    }
    if (event.type === "player_left") {
      const evidence = this.evidence("disappeared");
      return [
        this.event(event, "player_disconnected", evidence),
        this.event(event, "session_ended", evidence),
      ];
    }
    return [];
  }

  private event(
    source: ServerEvent,
    type: WorldEventType,
    evidence: WorldEventEvidence[],
  ): NewWorldEvent {
    const identity = [
      source.serverId,
      source.playerId,
      source.occurredAt,
      type,
    ].join("\u0000");
    return {
      id: `wie_${createHash("sha256").update(identity).digest("hex").slice(0, 24)}`,
      serverId: source.serverId,
      userId: source.playerId as string,
      playerId: null,
      timestamp: source.occurredAt,
      type,
      metadata: source.playerName ? { playerName: source.playerName } : {},
      confidence: 1,
      evidence,
      position: null,
    };
  }

  private evidence(fact: "appeared" | "disappeared"): WorldEventEvidence[] {
    return [{ source: "players", fact, value: "online_roster" }];
  }
}
