import type { StoredConnection } from "../../types/connections.js";
import type { NewPlayerPositionSnapshot } from "../types/player-telemetry.js";

export interface PlayerTelemetryProvider {
  collect(
    connection: StoredConnection,
    capturedAt: string,
  ): Promise<NewPlayerPositionSnapshot[]>;
}
