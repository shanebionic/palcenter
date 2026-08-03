export interface PublicConnection {
  id: string;
  name: string;
  baseUrl: string;
  createdAt: string;
  updatedAt: string;
  companion: {
    enabled: boolean;
    host: string | null;
    port: number;
    tokenConfigured: boolean;
  };
}

export interface ServerStatus {
  id: string;
  name: string;
  status: "online" | "offline";
  serverName: string | null;
  players: number | null;
  maxPlayers: number | null;
  fps: number | null;
  version: string | null;
  responseTimeMs: number | null;
  uptimeSeconds: number | null;
  passwordProtected: boolean | null;
  lastUpdated: string;
}

export interface ServerConfiguration {
  restUrl: string;
  publicIp: string | null;
  publicPort: number | null;
  restPort: number | null;
  rconEnabled: boolean | null;
  rconPort: number | null;
  region: string | null;
  crossplayPlatforms: string | null;
}

export interface ServerWorkspaceData {
  connection: PublicConnection;
  status: ServerStatus;
  configuration: ServerConfiguration;
}

export interface ConnectedPlayer {
  name: string;
  playerId: string;
  userId: string;
  ip: string | null;
  status: "online";
}

export interface PlayerPositionSnapshot {
  id: number;
  serverId: string;
  userId: string;
  playerId: string | null;
  playerName: string;
  accountName: string | null;
  capturedAt: string;
  x: number | null;
  y: number | null;
  z: number | null;
  level: number | null;
  ping: number | null;
  buildingCount: number | null;
  guildId: string | null;
  guildName: string | null;
  coordinateSpaceId: string;
  createdAt: string;
}

export interface LatestPlayerTelemetry {
  players: PlayerPositionSnapshot[];
  trustedPositions: PlayerPositionSnapshot[];
  pollingIntervalSeconds: number;
  lastCollectedAt: string | null;
}

export interface PlayerTrailPoint {
  capturedAt: string;
  x: number | null;
  y: number | null;
  coordinateSpaceId: string;
}

export interface PlayerTrailHistory {
  points: PlayerTrailPoint[];
  limit: number;
  truncated: boolean;
}

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

export interface WorldEvent {
  id: string;
  serverId: string;
  userId: string;
  playerId: string | null;
  timestamp: string;
  type: WorldEventType;
  metadata: Record<string, string | number | boolean | null>;
  confidence: number;
  evidence: Array<{
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
  }>;
  position: { x: number; y: number; z: number | null } | null;
}

export interface WorldEventQuery {
  userId?: string;
  type?: WorldEventType;
  from?: string;
  to?: string;
  limit?: number;
}

export interface ServerSettings {
  general: {
    serverName: string | null;
    description: string | null;
    version: string | null;
    region: string | null;
  };
  gameplay: {
    difficulty: string | null;
    experienceMultiplier: number | null;
    captureRate: number | null;
    collectionDropRate: number | null;
    enemyDropRate: number | null;
    daySpeed: number | null;
    nightSpeed: number | null;
    deathPenalty: string | null;
  };
  server: {
    maxPlayers: number | null;
    publicIp: string | null;
    publicPort: number | null;
    restApiPort: number | null;
    rconEnabled: boolean | null;
    rconPort: number | null;
  };
  security: {
    passwordProtected: boolean | null;
  };
  crossplay: {
    platforms: string[] | null;
  };
}

export interface ServerMetric {
  id: number;
  serverId: string;
  status: "online" | "offline";
  playerCount: number | null;
  maxPlayers: number | null;
  fps: number | null;
  responseTimeMs: number | null;
  uptimeSeconds: number | null;
  capturedAt: string;
}

export type ServerEventType =
  | "server_online"
  | "server_offline"
  | "server_restarted"
  | "player_joined"
  | "player_left"
  | "player_banned";

export interface ServerEvent {
  id: number;
  serverId: string;
  type: ServerEventType;
  playerId: string | null;
  playerName: string | null;
  occurredAt: string;
}

interface NotificationConfigurationBase {
  id: string;
  name: string;
  enabled: boolean;
  events: ServerEventType[];
  createdAt: string;
  updatedAt: string;
}

export interface DiscordNotificationConfiguration extends NotificationConfigurationBase {
  type: "discord";
  webhookConfigured: boolean;
}

export interface NtfyNotificationConfiguration extends NotificationConfigurationBase {
  type: "ntfy";
  serverUrl: string;
  topic: string;
}

export type NotificationConfiguration =
  | DiscordNotificationConfiguration
  | NtfyNotificationConfiguration;

export type NotificationConfigurationInput =
  | {
      type: "discord";
      name: string;
      enabled: boolean;
      events: ServerEventType[];
      webhookUrl: string;
    }
  | {
      type: "ntfy";
      name: string;
      enabled: boolean;
      events: ServerEventType[];
      serverUrl: string;
      topic: string;
    };

export type NotificationConfigurationUpdate =
  | {
      type: "discord";
      name: string;
      enabled: boolean;
      events: ServerEventType[];
      webhookUrl?: string;
    }
  | {
      type: "ntfy";
      name: string;
      enabled: boolean;
      events: ServerEventType[];
      serverUrl: string;
      topic: string;
    };

export interface BackupDataStatus {
  available: boolean;
  sizeBytes: number | null;
}

export interface BackupInfo {
  applicationVersion: string;
  backupFormatVersion: number;
  compatibleFormatVersions: number[];
  data: {
    servers: BackupDataStatus;
    notifications: BackupDataStatus;
    history: BackupDataStatus;
    users: BackupDataStatus;
  };
}

export type UserRole = "administrator" | "moderator" | "visitor";

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  enabled: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}
