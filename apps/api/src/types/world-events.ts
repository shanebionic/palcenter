export const worldEventTypes = [
  "player_joined",
  "player_disconnected",
  "session_started",
  "session_ended",
  "player_died",
  "player_respawned",
  "player_idle_started",
  "player_idle_ended",
  "player_afk_started",
  "player_afk_ended",
  "player_rapid_relocation",
] as const;

export type WorldEventType = (typeof worldEventTypes)[number];

export interface WorldEventEvidence {
  source: "players" | "telemetry" | "transition_registry";
  fact:
    | "appeared"
    | "disappeared"
    | "state_changed"
    | "within_radius"
    | "roster_present"
    | "moved_beyond_radius"
    | "prior_state"
    | "rapid_displacement"
    | "implied_speed"
    | "observation_continuous"
    | "coordinate_space_changed"
    | "transition_signature_matched";
  value: string;
}

export type WorldEventMetadata = Record<
  string,
  string | number | boolean | null
>;

export interface WorldEventPosition {
  x: number;
  y: number;
  z: number | null;
}

export interface WorldEvent {
  id: string;
  serverId: string;
  userId: string;
  playerId: string | null;
  timestamp: string;
  type: WorldEventType;
  metadata: WorldEventMetadata;
  confidence: number;
  evidence: WorldEventEvidence[];
  position: WorldEventPosition | null;
}

export interface NewWorldEvent extends WorldEvent {}

export interface WorldEventQuery {
  userId?: string;
  type?: WorldEventType;
  from?: string;
  to?: string;
  limit: number;
}

export type PlayerActivityStateName = "active" | "idle" | "afk";

export interface PlayerActivityState {
  serverId: string;
  userId: string;
  playerId: string | null;
  playerName: string;
  state: PlayerActivityStateName;
  anchorAt: string;
  anchorX: number;
  anchorY: number;
  lastSampleAt: string;
  lastX: number;
  lastY: number;
  coordinateSpaceId: string;
}
