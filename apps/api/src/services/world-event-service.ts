import { createHash } from "node:crypto";
import type { ConnectionRepository } from "../repositories/connection-repository.js";
import type { WorldEventRepository } from "../repositories/world-event-repository.js";
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
    return this.repository.list(serverId, query);
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
