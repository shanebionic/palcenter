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
  playerHistory(
    serverId: string,
    playerId: string,
    query: PlayerTelemetryHistoryQuery,
  ): PlayerPositionSnapshot[];
  deleteServerData(serverId: string): void;
}
