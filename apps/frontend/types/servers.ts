export interface PublicConnection {
  id: string;
  name: string;
  baseUrl: string;
  createdAt: string;
  updatedAt: string;
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
