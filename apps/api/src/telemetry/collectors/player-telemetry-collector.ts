import type { StoredConnection } from "../../types/connections.js";
import type { NewPlayerPositionSnapshot } from "../types/player-telemetry.js";
import type { PlayerTelemetryProvider } from "../providers/player-telemetry-provider.js";

export function isPalDefenderConfigured(connection: StoredConnection): boolean {
  return (
    (connection.palDefenderEnabled ?? false) &&
    Boolean(connection.palDefenderEndpoint && connection.palDefenderToken)
  );
}

export class ProviderAwarePlayerTelemetryCollector {
  constructor(
    private readonly nativeRestProvider: PlayerTelemetryProvider,
    private readonly palDefenderProvider: PlayerTelemetryProvider,
  ) {}

  async collect(
    connection: StoredConnection,
    capturedAt = new Date().toISOString(),
  ): Promise<NewPlayerPositionSnapshot[]> {
    const provider = isPalDefenderConfigured(connection)
      ? this.palDefenderProvider
      : this.nativeRestProvider;

    return provider.collect(connection, capturedAt);
  }
}
