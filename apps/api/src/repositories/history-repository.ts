import type {
  ObservedPlayer,
  ServerEvent,
  ServerEventType,
  ServerMetric,
} from "../types/connections.js";

export type NewServerMetric = Omit<ServerMetric, "id">;
export type NewServerEvent = Omit<ServerEvent, "id">;

export interface HistoryRepository {
  initialize(): void;
  latestMetric(serverId: string): ServerMetric | null;
  activePlayers(serverId: string): ObservedPlayer[];
  saveSample(
    metric: NewServerMetric,
    events: NewServerEvent[],
    players: ObservedPlayer[],
  ): void;
  listMetrics(serverId: string, limit: number): ServerMetric[];
  listEvents(serverId: string, limit: number): ServerEvent[];
}

export function isServerEventType(value: string): value is ServerEventType {
  return [
    "server_online",
    "server_offline",
    "server_restarted",
    "player_joined",
    "player_left",
  ].includes(value);
}
