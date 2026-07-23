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
