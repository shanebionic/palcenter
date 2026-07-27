import type { ConnectionRepository } from "../repositories/connection-repository.js";
import type { HistoryRepository } from "../repositories/history-repository.js";

export class RemovalServerNotFoundError extends Error {}

export class ServerRemovalError extends Error {}

export interface ServerRemovalMonitoringControl {
  pause(): Promise<void>;
  resume(): void;
}

export class ServerRemovalService {
  constructor(
    private readonly connections: ConnectionRepository,
    private readonly history: HistoryRepository,
    private readonly monitoring: ServerRemovalMonitoringControl,
  ) {}

  async remove(serverId: string): Promise<void> {
    const connection = await this.connections.get(serverId);

    if (!connection) {
      throw new RemovalServerNotFoundError(
        "The requested server does not exist.",
      );
    }

    await this.monitoring.pause();

    try {
      try {
        await this.connections.delete(serverId);
      } catch (error) {
        throw new ServerRemovalError(
          "PalCenter could not remove the saved server connection.",
          { cause: error },
        );
      }

      try {
        this.history.deleteServerData(serverId);
      } catch (error) {
        try {
          await this.connections.create(connection);
        } catch (rollbackError) {
          throw new ServerRemovalError(
            "PalCenter could not remove the server and could not restore its saved connection.",
            { cause: new AggregateError([error, rollbackError]) },
          );
        }

        throw new ServerRemovalError(
          "PalCenter could not remove the server. Its saved connection was restored.",
          { cause: error },
        );
      }
    } finally {
      this.monitoring.resume();
    }
  }
}
