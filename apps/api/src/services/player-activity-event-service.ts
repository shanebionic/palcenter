import { createHash } from "node:crypto";
import type { WorldEventRepository } from "../repositories/world-event-repository.js";
import type { NewPlayerPositionSnapshot } from "../telemetry/types/player-telemetry.js";
import type {
  NewWorldEvent,
  PlayerActivityState,
  WorldEvent,
  WorldEventEvidence,
  WorldEventMetadata,
  WorldEventType,
} from "../types/world-events.js";
import {
  impliedWorldSpeed,
  planarWorldDisplacement,
} from "./world-coordinate-math.js";
import {
  SpatialTransitionRegistry,
  type MatchedSpatialTransition,
  unknownCoordinateSpaceId,
} from "./spatial-transition-registry.js";

export const playerActivityThresholds = {
  movementRadius: 300,
  idleDurationMs: 10 * 60 * 1_000,
  afkDurationMs: 30 * 60 * 1_000,
  maximumObservationGapMs: 5 * 60 * 1_000,
} as const;

export const rapidRelocationThresholds = {
  minimumElapsedMs: 5_000,
  maximumObservationGapMs: 90_000,
  minimumDisplacement: 200_000,
  minimumImplausibleSpeed: 2_500,
} as const;

export class PlayerActivityEventService {
  constructor(
    private readonly repository: WorldEventRepository,
    private readonly transitionRegistry = new SpatialTransitionRegistry(),
  ) {}

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
      if (
        existing.playerId &&
        snapshot.playerId &&
        existing.playerId !== snapshot.playerId
      ) {
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

      const elapsedMs = timestamp - lastTimestamp;
      const consecutiveDisplacement = planarWorldDisplacement(
        { x: existing.lastX, y: existing.lastY },
        { x: snapshot.x, y: snapshot.y },
      );
      const consecutiveSpeed = impliedWorldSpeed(
        consecutiveDisplacement,
        elapsedMs,
      );
      const trustedSpatialInterval =
        elapsedMs >= rapidRelocationThresholds.minimumElapsedMs &&
        elapsedMs <= rapidRelocationThresholds.maximumObservationGapMs;
      const transition = trustedSpatialInterval
        ? this.transitionRegistry.match(
            existing.coordinateSpaceId,
            { x: existing.lastX, y: existing.lastY },
            { x: snapshot.x, y: snapshot.y },
          )
        : null;
      const rapidRelocation =
        transition === null &&
        trustedSpatialInterval &&
        consecutiveDisplacement >=
          rapidRelocationThresholds.minimumDisplacement &&
        consecutiveSpeed >= rapidRelocationThresholds.minimumImplausibleSpeed;

      const displacement = planarWorldDisplacement(
        { x: existing.anchorX, y: existing.anchorY },
        { x: snapshot.x, y: snapshot.y },
      );
      if (
        transition ||
        displacement > playerActivityThresholds.movementRadius
      ) {
        if (existing.state === "idle" || existing.state === "afk") {
          events.push(
            transition
              ? this.activityEndedByTransition(snapshot, existing, transition)
              : this.activityEnded(snapshot, existing, displacement),
          );
        }
        if (transition) {
          events.push(
            this.spatialTransition(snapshot, existing, transition, elapsedMs),
          );
        } else if (rapidRelocation) {
          events.push(
            this.rapidRelocation(
              snapshot,
              existing,
              elapsedMs,
              consecutiveDisplacement,
              consecutiveSpeed,
            ),
          );
        }
        next.push(
          this.initialState(
            snapshot,
            transition?.destinationCoordinateSpaceId ??
              existing.coordinateSpaceId,
          ),
        );
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
    coordinateSpaceId = this.transitionRegistry.coordinateSpaceAt({
      x: snapshot.x as number,
      y: snapshot.y as number,
    }),
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
      coordinateSpaceId,
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

  private activityEndedByTransition(
    snapshot: NewPlayerPositionSnapshot,
    previous: PlayerActivityState,
    transition: MatchedSpatialTransition,
  ): NewWorldEvent {
    return this.event(
      snapshot,
      previous.state === "afk" ? "player_afk_ended" : "player_idle_ended",
      {
        priorActivityState: previous.state,
        originCoordinateSpaceId: transition.originCoordinateSpaceId,
        destinationCoordinateSpaceId: transition.destinationCoordinateSpaceId,
      },
      [
        {
          source: "transition_registry",
          fact: "coordinate_space_changed",
          value: `${transition.originCoordinateSpaceId} to ${transition.destinationCoordinateSpaceId}`,
        },
        {
          source: "telemetry",
          fact: "prior_state",
          value: previous.state,
        },
      ],
    );
  }

  private rapidRelocation(
    snapshot: NewPlayerPositionSnapshot,
    previous: PlayerActivityState,
    elapsedMs: number,
    displacement: number,
    speed: number,
  ): NewWorldEvent {
    const elapsedSeconds = elapsedMs / 1_000;
    const roundedDistance = Math.round(displacement);
    const roundedSpeed = Math.round(speed);
    const coordinateSpaceKnown =
      previous.coordinateSpaceId !== unknownCoordinateSpaceId;
    const comparableMovementMetadata: WorldEventMetadata = coordinateSpaceKnown
      ? { displacement: roundedDistance, impliedSpeed: roundedSpeed }
      : {};
    const comparableMovementEvidence: WorldEventEvidence[] =
      coordinateSpaceKnown
        ? [
            {
              source: "telemetry",
              fact: "rapid_displacement",
              value: `${roundedDistance} world units in ${elapsedSeconds} seconds`,
            },
            {
              source: "telemetry",
              fact: "implied_speed",
              value: `${roundedSpeed} world units per second`,
            },
          ]
        : [];
    return this.event(
      snapshot,
      "player_rapid_relocation",
      {
        classification: "unexplained_relocation",
        originCoordinateSpaceId: previous.coordinateSpaceId,
        destinationCoordinateSpaceId: previous.coordinateSpaceId,
        originTimestamp: previous.lastSampleAt,
        originX: previous.lastX,
        originY: previous.lastY,
        destinationX: snapshot.x,
        destinationY: snapshot.y,
        elapsedSeconds,
        ...comparableMovementMetadata,
      },
      [
        ...comparableMovementEvidence,
        {
          source: "telemetry",
          fact: "observation_continuous",
          value: `${elapsedSeconds} seconds between consecutive roster samples`,
        },
      ],
    );
  }

  private spatialTransition(
    snapshot: NewPlayerPositionSnapshot,
    previous: PlayerActivityState,
    transition: MatchedSpatialTransition,
    elapsedMs: number,
  ): NewWorldEvent {
    const classification =
      transition.signature.type === "secondary_map"
        ? "likely_map_transition"
        : "likely_instance_transition";
    return this.event(
      snapshot,
      "player_rapid_relocation",
      {
        classification,
        transitionDirection: transition.direction,
        matchedTransitionSignatureId: transition.signature.id,
        matchedTransitionDisplayName: transition.signature.displayName,
        transitionType: transition.signature.type,
        originTimestamp: previous.lastSampleAt,
        originCoordinateSpaceId: transition.originCoordinateSpaceId,
        destinationCoordinateSpaceId: transition.destinationCoordinateSpaceId,
        originX: previous.lastX,
        originY: previous.lastY,
        destinationX: snapshot.x,
        destinationY: snapshot.y,
        elapsedSeconds: elapsedMs / 1_000,
      },
      [
        {
          source: "transition_registry",
          fact: "transition_signature_matched",
          value: transition.signature.displayName,
        },
        {
          source: "transition_registry",
          fact: "coordinate_space_changed",
          value: `${transition.originCoordinateSpaceId} to ${transition.destinationCoordinateSpaceId}`,
        },
        {
          source: "telemetry",
          fact: "observation_continuous",
          value: `${elapsedMs / 1_000} seconds between consecutive roster samples`,
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
