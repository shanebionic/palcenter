import type {
  NewWorldEvent,
  WorldEvent,
  WorldEventQuery,
} from "../types/world-events.js";

export interface WorldEventRepository {
  initialize(): void;
  close(): void;
  reopen(): void;
  append(events: NewWorldEvent[]): WorldEvent[];
  list(serverId: string, query: WorldEventQuery): WorldEvent[];
  deleteServerData(serverId: string): void;
}
