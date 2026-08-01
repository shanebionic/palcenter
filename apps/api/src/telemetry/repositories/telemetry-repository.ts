import type {
  NewPlayerPositionSnapshot,
  PlayerPositionSnapshot,
  PlayerTelemetryHistoryQuery,
} from "../types/player-telemetry.js";

export interface TelemetryRepository {
  initialize(): void;
  close(): void;
  reopen(): void;
  insertPlayerSnapshots(snapshots: NewPlayerPositionSnapshot[]): void;
  latestPlayerSnapshots(serverId: string): PlayerPositionSnapshot[];
  latestPlayerSnapshotsInSpace(
    serverId: string,
    coordinateSpaceId: string,
  ): PlayerPositionSnapshot[];
  playerHistory(
    serverId: string,
    userId: string,
    query: PlayerTelemetryHistoryQuery,
  ): PlayerPositionSnapshot[];
  deleteExpiredPlayerSnapshots(cutoff: string, limit: number): number;
  deleteServerData(serverId: string): void;
}
