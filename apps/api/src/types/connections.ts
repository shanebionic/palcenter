export interface StoredConnection {
  id: string;
  name: string;
  baseUrl: string;
  adminPassword: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicConnection {
  id: string;
  name: string;
  baseUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectionFile {
  version: 1;
  servers: StoredConnection[];
}

export interface PalworldServerInfo {
  version: string;
  servername: string;
  description: string;
  worldguid: string;
}

export interface PalworldServerMetrics {
  currentplayernum: number;
  serverfps: number;
  serverfpsaverage?: number;
  serverframetime: number;
  days: number;
  maxplayernum: number;
  basecampnum: number;
  uptime: number;
}

export interface PalworldServerSettings {
  Difficulty?: string;
  DayTimeSpeedRate?: number;
  NightTimeSpeedRate?: number;
  ExpRate?: number;
  PalCaptureRate?: number;
  CollectionDropRate?: number;
  EnemyDropItemRate?: number;
  DeathPenalty?: string;
  ServerPlayerMaxNum?: number;
  ServerName?: string;
  ServerDescription?: string;
  PublicIP?: string;
  PublicPort?: number;
  RCONEnabled?: boolean;
  RCONPort?: number;
  Region?: string;
  RESTAPIPort?: number;
  bUseAuth?: boolean;
  AllowConnectPlatform?: string;
  CrossplayPlatforms?: string | string[];
}

export interface PalworldPlayer {
  name: string;
  accountName: string;
  playerId: string;
  userId: string;
  ip?: string;
  ping: number;
  location_x: number;
  location_y: number;
  level: number;
  building_count: number;
}

export interface PalworldPlayersResponse {
  players: PalworldPlayer[];
}

export interface ConnectedPlayer {
  name: string;
  playerId: string;
  userId: string;
  ip: string | null;
  status: "online";
}

export interface ConnectionTestResult {
  info: PalworldServerInfo;
  metrics: PalworldServerMetrics;
  latencyMs: number;
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

export interface ServerWorkspace {
  connection: PublicConnection;
  status: ServerStatus;
  configuration: ServerConfiguration;
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

export interface ObservedPlayer {
  playerId: string;
  name: string;
}

export interface ServerSettingsView {
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
