import { createHash } from "node:crypto";
import type { WorldEventRepository } from "../repositories/world-event-repository.js";
import type { NewPlayerPositionSnapshot } from "../telemetry/types/player-telemetry.js";
import type {
  NewWorldEvent,
  PlayerActivityState,
  WorldEvent,
  WorldEventType,
} from "../types/world-events.js";

export const playerActivityThresholds = {
  movementRadius: 300,
  idleDurationMs: 10 * 60 * 1_000,
  afkDurationMs: 30 * 60 * 1_000,
  maximumObservationGapMs: 5 * 60 * 1_000,
} as const;

export class PlayerActivityEventService {
  constructor(private readonly repository: WorldEventRepository) {}

  process(
    serverId: string,
    snapshots: NewPlayerPositionSnapshot[],
  ): WorldEvent[] {
    const previous = new Map(
      this.repository
        .activityStates(serverId)
        .map((state) => [state.userId, state]),
    );
    const next: PlayerActivityState[] = [];
    const events: NewWorldEvent[] = [];
    const observed = new Set<string>();

    for (const snapshot of snapshots) {
      if (observed.has(snapshot.userId)) continue;
      observed.add(snapshot.userId);
      if (snapshot.x === null || snapshot.y === null) {
        const existing = previous.get(snapshot.userId);
        if (existing) next.push(existing);
        continue;
      }
      const existing = previous.get(snapshot.userId);
      if (!existing) {
        next.push(this.initialState(snapshot));
        continue;
      }

      const timestamp = Date.parse(snapshot.capturedAt);
      const lastTimestamp = Date.parse(existing.lastSampleAt);
      if (!Number.isFinite(timestamp) || timestamp <= lastTimestamp) {
        next.push(existing);
        continue;
      }
      if (
        timestamp - lastTimestamp >
        playerActivityThresholds.maximumObservationGapMs
      ) {
        next.push(this.initialState(snapshot));
        continue;
      }

      const displacement = Math.hypot(
        snapshot.x - existing.anchorX,
        snapshot.y - existing.anchorY,
      );
      if (displacement > playerActivityThresholds.movementRadius) {
        if (existing.state === "idle" || existing.state === "afk") {
          events.push(this.activityEnded(snapshot, existing, displacement));
        }
        next.push(this.initialState(snapshot));
        continue;
      }

      const inactiveForMs = timestamp - Date.parse(existing.anchorAt);
      let state = existing.state;
      if (
        state === "active" &&
        inactiveForMs >= playerActivityThresholds.idleDurationMs
      ) {
        state = "idle";
        events.push(
          this.inactivityStarted(
            snapshot,
            "player_idle_started",
            inactiveForMs,
          ),
        );
      } else if (
        state === "idle" &&
        inactiveForMs >= playerActivityThresholds.afkDurationMs
      ) {
        state = "afk";
        events.push(
          this.inactivityStarted(snapshot, "player_afk_started", inactiveForMs),
        );
      }

      next.push({
        ...existing,
        playerId: snapshot.playerId,
        playerName: snapshot.playerName,
        state,
        lastSampleAt: snapshot.capturedAt,
        lastX: snapshot.x,
        lastY: snapshot.y,
      });
    }

    return this.repository.commitActivityObservation(serverId, next, events);
  }

  private initialState(
    snapshot: NewPlayerPositionSnapshot,
  ): PlayerActivityState {
    return {
      serverId: snapshot.serverId,
      userId: snapshot.userId,
      playerId: snapshot.playerId,
      playerName: snapshot.playerName,
      state: "active",
      anchorAt: snapshot.capturedAt,
      anchorX: snapshot.x as number,
      anchorY: snapshot.y as number,
      lastSampleAt: snapshot.capturedAt,
      lastX: snapshot.x as number,
      lastY: snapshot.y as number,
    };
  }

  private inactivityStarted(
    snapshot: NewPlayerPositionSnapshot,
    type: "player_idle_started" | "player_afk_started",
    inactiveForMs: number,
  ): NewWorldEvent {
    const minutes = Math.round(inactiveForMs / 60_000);
    return this.event(
      snapshot,
      type,
      {
        inactivityMinutes: minutes,
        movementRadius: playerActivityThresholds.movementRadius,
        classification: "inactivity_observed",
      },
      [
        {
          source: "telemetry",
          fact: "within_radius",
          value: `${playerActivityThresholds.movementRadius} world units for ${minutes} minutes`,
        },
        {
          source: "players",
          fact: "roster_present",
          value: "online_roster",
        },
        ...(type === "player_afk_started"
          ? [
              {
                source: "telemetry" as const,
                fact: "prior_state" as const,
                value: "idle",
              },
            ]
          : []),
      ],
    );
  }

  private activityEnded(
    snapshot: NewPlayerPositionSnapshot,
    previous: PlayerActivityState,
    displacement: number,
  ): NewWorldEvent {
    return this.event(
      snapshot,
      previous.state === "afk" ? "player_afk_ended" : "player_idle_ended",
      {
        displacement: Math.round(displacement),
        movementRadius: playerActivityThresholds.movementRadius,
        priorActivityState: previous.state,
      },
      [
        {
          source: "telemetry",
          fact: "moved_beyond_radius",
          value: `${Math.round(displacement)} world units`,
        },
        {
          source: "telemetry",
          fact: "prior_state",
          value: previous.state,
        },
      ],
    );
  }

  private event(
    snapshot: NewPlayerPositionSnapshot,
    type: WorldEventType,
    metadata: NewWorldEvent["metadata"],
    evidence: NewWorldEvent["evidence"],
  ): NewWorldEvent {
    const identity = [
      snapshot.serverId,
      snapshot.userId,
      snapshot.capturedAt,
      type,
    ].join("\u0000");
    return {
      id: `wie_${createHash("sha256").update(identity).digest("hex").slice(0, 24)}`,
      serverId: snapshot.serverId,
      userId: snapshot.userId,
      playerId: snapshot.playerId,
      timestamp: snapshot.capturedAt,
      type,
      metadata: { playerName: snapshot.playerName, ...metadata },
      confidence: 0.9,
      evidence,
      position:
        snapshot.x === null || snapshot.y === null
          ? null
          : { x: snapshot.x, y: snapshot.y, z: snapshot.z },
    };
  }
}
