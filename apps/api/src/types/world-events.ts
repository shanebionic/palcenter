export const worldEventTypes = [
  "player_joined",
  "player_disconnected",
  "session_started",
  "session_ended",
  "player_died",
  "player_respawned",
] as const;

export type WorldEventType = (typeof worldEventTypes)[number];

export interface WorldEventEvidence {
  source: "players";
  fact: "appeared" | "disappeared" | "state_changed";
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
