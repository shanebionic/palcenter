import { PalworldRestClient } from "../../clients/palworld-rest-client.js";
import type {
  PalworldPlayer,
  PalworldPlayersResponse,
  StoredConnection,
} from "../../types/connections.js";
import type { NewPlayerPositionSnapshot } from "../types/player-telemetry.js";

export interface PlayerTelemetryClient {
  getPlayers(): Promise<PalworldPlayersResponse>;
}

type PlayerTelemetryClientFactory = (
  connection: StoredConnection,
) => PlayerTelemetryClient;

const defaultClientFactory: PlayerTelemetryClientFactory = (connection) =>
  new PalworldRestClient(connection.baseUrl, connection.adminPassword);

export class PlayerTelemetryCollector {
  constructor(
    private readonly clientFactory: PlayerTelemetryClientFactory = defaultClientFactory,
  ) {}

  async collect(
    connection: StoredConnection,
    capturedAt = new Date().toISOString(),
  ): Promise<NewPlayerPositionSnapshot[]> {
    const response = await this.clientFactory(connection).getPlayers();

    if (!response || !Array.isArray(response.players)) {
      throw new Error("Palworld returned malformed player telemetry data.");
    }

    return response.players
      .map((player) => this.normalize(connection.id, player, capturedAt))
      .filter(
        (snapshot): snapshot is NewPlayerPositionSnapshot => snapshot !== null,
      );
  }

  private normalize(
    serverId: string,
    player: PalworldPlayer,
    capturedAt: string,
  ): NewPlayerPositionSnapshot | null {
    if (!player || typeof player !== "object") {
      return null;
    }

    const userId = this.text(player.userId);
    if (!userId) {
      return null;
    }

    return {
      serverId,
      userId,
      playerId: this.text(player.playerId),
      playerName:
        this.text(player.name) ?? this.text(player.accountName) ?? "Unknown",
      accountName: this.text(player.accountName),
      capturedAt,
      x: this.number(player.location_x),
      y: this.number(player.location_y),
      z: null,
      level: this.number(player.level),
      ping: this.number(player.ping),
      buildingCount: this.number(player.building_count),
      guildId: null,
      guildName: null,
    };
  }

  private text(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  private number(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }
}
