import { PalworldRestClient } from "../clients/palworld-rest-client.js";
import type { ConnectionRepository } from "../repositories/connection-repository.js";
import type { ConnectedPlayer } from "../types/connections.js";

export class PlayerServerNotFoundError extends Error {
  constructor() {
    super("The requested server does not exist.");
    this.name = "PlayerServerNotFoundError";
  }
}

export class PlayerService {
  constructor(private readonly repository: ConnectionRepository) {}

  async list(serverId: string): Promise<ConnectedPlayer[]> {
    const client = await this.clientFor(serverId);
    const result = await client.getPlayers();

    return result.players.map((player) => ({
      name: player.name,
      playerId: player.playerId,
      userId: player.userId,
      ip: player.ip?.trim() || null,
      status: "online",
    }));
  }

  async kick(serverId: string, userId: string): Promise<void> {
    const client = await this.clientFor(serverId);
    await client.kickPlayer(userId);
  }

  async ban(serverId: string, userId: string): Promise<void> {
    const client = await this.clientFor(serverId);
    await client.banPlayer(userId);
  }

  async unban(serverId: string, userId: string): Promise<void> {
    const client = await this.clientFor(serverId);
    await client.unbanPlayer(userId);
  }

  private async clientFor(serverId: string): Promise<PalworldRestClient> {
    const connection = await this.repository.get(serverId);

    if (!connection) {
      throw new PlayerServerNotFoundError();
    }

    return new PalworldRestClient(connection.baseUrl, connection.adminPassword);
  }
}
