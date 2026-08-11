import type {
  NewWorldEvent,
  PlayerActivityState,
  WorldEvent,
  WorldEventQuery,
} from "../types/world-events.js";

export interface WorldEventRepository {
  initialize(): void;
  close(): void;
  reopen(): void;
  append(events: NewWorldEvent[]): WorldEvent[];
  activityStates(serverId: string): PlayerActivityState[];
  commitActivityObservation(
    serverId: string,
    states: PlayerActivityState[],
    events: NewWorldEvent[],
  ): WorldEvent[];
  list(serverId: string, query: WorldEventQuery): WorldEvent[];
  deleteServerData(serverId: string): void;
}
