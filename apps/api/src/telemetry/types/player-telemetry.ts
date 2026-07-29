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
  createdAt: string;
}

export type NewPlayerPositionSnapshot = Omit<
  PlayerPositionSnapshot,
  "id" | "createdAt"
>;

export interface PlayerTelemetryHistoryQuery {
  from?: string;
  to?: string;
  limit: number;
}

export interface PlayerTrailPoint {
  capturedAt: string;
  x: number | null;
  y: number | null;
}
