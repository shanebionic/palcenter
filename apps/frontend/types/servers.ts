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
