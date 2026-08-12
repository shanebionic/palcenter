import {
  PalDefenderClient,
  type PalDefenderPlayerDetails,
} from "../../clients/paldefender-client.js";
import type { StoredConnection } from "../../types/connections.js";
import type { NewPlayerPositionSnapshot } from "../types/player-telemetry.js";
import type { PlayerTelemetryProvider } from "./player-telemetry-provider.js";

const PALDEFENDER_DETAIL_CONCURRENCY = 10;
const PALDEFENDER_DETAIL_TIMEOUT_MS = 3_000;

export class PalDefenderPlayerTelemetryProvider implements PlayerTelemetryProvider {
  constructor(
    private readonly clientFactory: (
      endpoint: string,
      token: string,
    ) => PalDefenderClient = (endpoint: string, token: string) =>
      new PalDefenderClient(endpoint, token),
  ) {}

  async collect(
    connection: StoredConnection,
    capturedAt: string,
  ): Promise<NewPlayerPositionSnapshot[]> {
    if (
      !connection.palDefenderEnabled ||
      !connection.palDefenderEndpoint ||
      !connection.palDefenderToken
    ) {
      throw new Error("PalDefender is not configured for this server.");
    }

    const client = this.clientFactory(
      connection.palDefenderEndpoint,
      connection.palDefenderToken,
    );

    const players = await client.getPlayers();

    if (players.length === 0) {
      return [];
    }

    const onlinePlayers = players.filter((p) => p.online);

    if (onlinePlayers.length === 0) {
      return [];
    }

    const details = await fetchPlayerDetails(client, onlinePlayers);

    return details.map((detail) =>
      normalizeSnapshot(connection.id, detail, capturedAt),
    );
  }
}

async function fetchPlayerDetails(
  client: PalDefenderClient,
  players: Array<{
    name: string;
    playerId: string;
    online: boolean;
    guild: string | null;
    level: number | null;
  }>,
): Promise<PalDefenderPlayerDetails[]> {
  const results: PalDefenderPlayerDetails[] = [];

  for (let i = 0; i < players.length; i += PALDEFENDER_DETAIL_CONCURRENCY) {
    const batch = players.slice(i, i + PALDEFENDER_DETAIL_CONCURRENCY);
    const batchResults = await Promise.allSettled(
      batch.map(async (player) => {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error("Player detail fetch timed out")),
            PALDEFENDER_DETAIL_TIMEOUT_MS,
          );
        });
        return await Promise.race([
          client.getPlayer(player.playerId),
          timeoutPromise,
        ]);
      }),
    );

    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        results.push(result.value);
      }
    }
  }

  return results;
}

function normalizeSnapshot(
  serverId: string,
  player: PalDefenderPlayerDetails,
  capturedAt: string,
): NewPlayerPositionSnapshot {
  const worldLocation = player.worldLocation;

  return {
    serverId,
    userId: player.playerId,
    playerId: text(player.playerId),
    playerName: text(player.name) ?? "Unknown",
    accountName: null,
    capturedAt,
    x: numberOrNull(worldLocation?.x),
    y: numberOrNull(worldLocation?.y),
    z: numberOrNull(worldLocation?.z),
    level: player.level,
    ping: null,
    buildingCount: null,
    guildId: null,
    guildName: text(player.guild),
  };
}

function text(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

function numberOrNull(value: number | undefined | null): number | null {
  return value !== undefined && value !== null && Number.isFinite(value)
    ? value
    : null;
}
