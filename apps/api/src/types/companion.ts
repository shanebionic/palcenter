export type CompanionConnectionState =
  | "connected"
  | "disabled"
  | "unreachable"
  | "authentication_required"
  | "authentication_failed"
  | "malformed_response"
  | "incompatible_contract";

export interface CompanionCapability {
  supported: boolean;
  capabilityVersion: string;
}
export interface CompanionStatus {
  state: CompanionConnectionState;
  checkedAt: string;
  health: "healthy" | null;
  version: {
    applicationVersion: string;
    apiVersion: string;
    buildCommit: string | null;
    buildBranch: string | null;
    buildDate: string | null;
    compiler: string | null;
    palworldVersion: string | null;
    ue4ssVersion: string | null;
    compatibility: Record<string, string>;
    runtime: {
      startedAt: string;
      uptimeSeconds: number;
      instanceId: string | null;
      checks: Record<string, string>;
    } | null;
  } | null;
  capabilities: Record<string, CompanionCapability>;
  adminActions?: Record<string, boolean>;
  administratorPlayerId?: string | null;
}

export interface CompanionAdminActionResponse {
  requestId: string;
  action: string;
  status: "succeeded" | "rejected";
  error: string | null;
  message: string;
}

export type CompanionPlayerActivityType =
  | "player_joined"
  | "player_left"
  | "session_started"
  | "session_ended";

export interface CompanionPlayerActivity {
  eventId: string;
  eventType: CompanionPlayerActivityType;
  timestamp: string;
  serverInstanceId: string;
  player: { userId: string | null; playerId: string | null; name: string };
  sessionId: string;
  source: "palworld_server_hook";
  schemaVersion: "1";
  durationSeconds: number | null;
  metadata: Record<string, unknown>;
}

export interface CompanionPlayerLocation {
  player: { userId: string | null; playerId: string | null; name: string };
  position: { x: number; y: number; z: number };
  coordinateSpaceId: "palpagos" | "special_area";
  stageInstanceId: string | null;
  capturedAt: string;
  source: "palworld_server_state";
}
