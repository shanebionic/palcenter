import { PalworldRestClient } from "../clients/palworld-rest-client.js";
import type { ConnectionRepository } from "../repositories/connection-repository.js";

export class ServerNotFoundError extends Error {
  constructor() {
    super("The requested server does not exist.");
    this.name = "ServerNotFoundError";
  }
}

export class ServerAdminService {
  constructor(private readonly repository: ConnectionRepository) {}

  async announce(serverId: string, message: string): Promise<void> {
    const client = await this.clientFor(serverId);
    await client.announce(message);
  }

  async saveWorld(serverId: string): Promise<void> {
    const client = await this.clientFor(serverId);
    await client.saveWorld();
  }

  async shutdown(
    serverId: string,
    waitTime: number,
    message?: string,
  ): Promise<void> {
    const client = await this.clientFor(serverId);
    await client.shutdown(waitTime, message);
  }

  async stop(serverId: string): Promise<void> {
    const client = await this.clientFor(serverId);
    await client.stop();
  }

  private async clientFor(serverId: string): Promise<PalworldRestClient> {
    const connection = await this.repository.get(serverId);

    if (!connection) {
      throw new ServerNotFoundError();
    }

    return new PalworldRestClient(connection.baseUrl, connection.adminPassword);
  }
}
