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
  PublicIP?: string;
  PublicPort?: number;
  RCONEnabled?: boolean;
  RCONPort?: number;
  Region?: string;
  RESTAPIPort?: number;
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
