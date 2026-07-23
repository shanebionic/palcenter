import { PalworldRestClient } from "../clients/palworld-rest-client.js";
import type { ConnectionRepository } from "../repositories/connection-repository.js";
import type { ServerStatus, StoredConnection } from "../types/connections.js";

export class ServerStatusService {
  constructor(private readonly repository: ConnectionRepository) {}

  async list(): Promise<ServerStatus[]> {
    const connections = await this.repository.list();

    return Promise.all(
      connections.map((connection) => this.getStatus(connection)),
    );
  }

  private async getStatus(connection: StoredConnection): Promise<ServerStatus> {
    try {
      const client = new PalworldRestClient(
        connection.baseUrl,
        connection.adminPassword,
      );
      const result = await client.testConnection();

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
    } catch {
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
  }
}
