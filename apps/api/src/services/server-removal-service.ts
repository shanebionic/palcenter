import type { ConnectionRepository } from "../repositories/connection-repository.js";
import type { CredentialRepository } from "../repositories/credential-repository.js";
import type { HistoryRepository } from "../repositories/history-repository.js";
import type { StoredPalDefenderCredential } from "../types/credentials.js";

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
    private readonly credentials: CredentialRepository | null = null,
  ) {}

  async remove(serverId: string): Promise<void> {
    const connection = await this.connections.get(serverId);

    if (!connection) {
      throw new RemovalServerNotFoundError(
        "The requested server does not exist.",
      );
    }

    await this.monitoring.pause();

    const credentialSnapshot = this.credentials
      ? this.credentials.listForServer(serverId)
      : [];

    try {
      try {
        if (this.credentials) {
          this.credentials.deleteForServer(serverId);
        }
      } catch (error) {
        throw new ServerRemovalError(
          "PalCenter could not remove the saved PalDefender user credentials.",
          { cause: error },
        );
      }

      try {
        await this.connections.delete(serverId);
      } catch (error) {
        throw this.compensate(
          error,
          credentialSnapshot,
          "PalCenter could not remove the saved server connection.",
        );
      }

      try {
        this.history.deleteServerData(serverId);
      } catch (error) {
        let connectionRestoreError: unknown;
        try {
          await this.connections.create(connection);
        } catch (restoreError) {
          connectionRestoreError = restoreError;
        }
        const message = connectionRestoreError
          ? "PalCenter could not remove the server and could not restore its saved connection."
          : "PalCenter could not remove the server. Its saved connection was restored.";
        throw this.compensate(
          connectionRestoreError
            ? new AggregateError([error, connectionRestoreError])
            : error,
          credentialSnapshot,
          message,
        );
      }
    } finally {
      this.monitoring.resume();
    }
  }

  private compensate(
    cause: unknown,
    snapshot: StoredPalDefenderCredential[],
    message: string,
  ): ServerRemovalError {
    if (snapshot.length === 0 || !this.credentials) {
      return new ServerRemovalError(message, { cause });
    }
    let restoreError: unknown;
    try {
      for (const credential of snapshot) {
        this.credentials.restore(credential);
      }
    } catch (error) {
      restoreError = error;
    }
    if (restoreError) {
      return new ServerRemovalError(
        `${message} The saved PalDefender user credentials could not be restored.`,
        { cause: new AggregateError([cause, restoreError]) },
      );
    }
    return new ServerRemovalError(
      `${message} The saved PalDefender user credentials were restored.`,
      { cause },
    );
  }
}
