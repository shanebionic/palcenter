import { PalworldRestClient } from "../clients/palworld-rest-client.js";
import type { ConnectionRepository } from "../repositories/connection-repository.js";
import type {
  ConnectionTestResult,
  PalworldServerSettings,
  PublicConnection,
  ServerConfiguration,
  ServerStatus,
  ServerWorkspace,
  StoredConnection,
} from "../types/connections.js";

export class ServerStatusService {
  constructor(private readonly repository: ConnectionRepository) {}

  async list(): Promise<ServerStatus[]> {
    const connections = await this.repository.list();

    return Promise.all(
      connections.map((connection) => this.getStatus(connection)),
    );
  }

  async get(id: string): Promise<ServerWorkspace | null> {
    const connection = await this.repository.get(id);

    if (!connection) {
      return null;
    }

    const client = new PalworldRestClient(
      connection.baseUrl,
      connection.adminPassword,
    );

    try {
      const [result, settings] = await Promise.all([
        client.testConnection(),
        client.getSettings().catch(() => null),
      ]);

      return {
        connection: this.sanitize(connection),
        status: this.onlineStatus(connection, result),
        configuration: this.configuration(connection, settings),
      };
    } catch {
      return {
        connection: this.sanitize(connection),
        status: this.offlineStatus(connection),
        configuration: this.configuration(connection, null),
      };
    }
  }

  private async getStatus(connection: StoredConnection): Promise<ServerStatus> {
    try {
      const client = new PalworldRestClient(
        connection.baseUrl,
        connection.adminPassword,
      );
      const result = await client.testConnection();

      return this.onlineStatus(connection, result);
    } catch {
      return this.offlineStatus(connection);
    }
  }

  private onlineStatus(
    connection: StoredConnection,
    result: ConnectionTestResult,
  ): ServerStatus {
    return {
      id: connection.id,
      name: connection.name,
      status: "online",
      serverName: result.info.servername,
      players: result.metrics.currentplayernum,
      maxPlayers: result.metrics.maxplayernum,
      fps: result.metrics.serverfps,
      version: result.info.version,
      responseTimeMs: result.latencyMs,
      lastUpdated: new Date().toISOString(),
    };
  }

  private offlineStatus(connection: StoredConnection): ServerStatus {
    return {
      id: connection.id,
      name: connection.name,
      status: "offline",
      serverName: null,
      players: null,
      maxPlayers: null,
      fps: null,
      version: null,
      responseTimeMs: null,
      lastUpdated: new Date().toISOString(),
    };
  }

  private configuration(
    connection: StoredConnection,
    settings: PalworldServerSettings | null,
  ): ServerConfiguration {
    return {
      restUrl: connection.baseUrl,
      publicIp: this.textOrNull(settings?.PublicIP),
      publicPort: settings?.PublicPort ?? null,
      restPort: settings?.RESTAPIPort ?? null,
      rconEnabled: settings?.RCONEnabled ?? null,
      rconPort: settings?.RCONPort ?? null,
      region: this.textOrNull(settings?.Region),
      crossplayPlatforms: this.crossplayPlatforms(settings),
    };
  }

  private crossplayPlatforms(
    settings: PalworldServerSettings | null,
  ): string | null {
    const platforms =
      settings?.CrossplayPlatforms ?? settings?.AllowConnectPlatform;

    if (Array.isArray(platforms)) {
      return platforms.length > 0 ? platforms.join(", ") : null;
    }

    return this.textOrNull(platforms);
  }

  private textOrNull(value: string | undefined): string | null {
    const text = value?.trim();
    return text ? text : null;
  }

  private sanitize(connection: StoredConnection): PublicConnection {
    return {
      id: connection.id,
      name: connection.name,
      baseUrl: connection.baseUrl,
      createdAt: connection.createdAt,
      updatedAt: connection.updatedAt,
    };
  }
}
