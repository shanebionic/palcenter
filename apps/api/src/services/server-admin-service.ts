import { PalworldRestClient } from "../clients/palworld-rest-client.js";
import type { ConnectionRepository } from "../repositories/connection-repository.js";
import type {
  PalDefenderActor,
  PalDefenderStatus,
} from "./paldefender-service.js";

export type BroadcastProvider = "paldefender" | "native";

interface BroadcastCapability {
  status(serverId: string): Promise<PalDefenderStatus>;
  broadcast(
    serverId: string,
    message: string,
    actor?: PalDefenderActor,
  ): Promise<unknown>;
}

type NativeClient = Pick<
  PalworldRestClient,
  "announce" | "saveWorld" | "shutdown" | "stop"
>;
type NativeClientFactory = (
  baseUrl: string,
  adminPassword: string,
) => NativeClient;

export class ServerNotFoundError extends Error {
  constructor() {
    super("The requested server does not exist.");
    this.name = "ServerNotFoundError";
  }
}

export class ServerAdminService {
  constructor(
    private readonly repository: ConnectionRepository,
    private readonly palDefender?: BroadcastCapability,
    private readonly createNativeClient: NativeClientFactory = (
      baseUrl,
      adminPassword,
    ) => new PalworldRestClient(baseUrl, adminPassword),
  ) {}

  async announce(
    serverId: string,
    message: string,
    actor?: PalDefenderActor,
  ): Promise<{ provider: BroadcastProvider }> {
    if (await this.palDefenderAvailable(serverId)) {
      await this.palDefender!.broadcast(serverId, message, actor);
      return { provider: "paldefender" };
    }

    const client = await this.clientFor(serverId);
    await client.announce(message);
    return { provider: "native" };
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

  private async palDefenderAvailable(serverId: string): Promise<boolean> {
    if (!this.palDefender) return false;
    return (await this.palDefender.status(serverId)).connected;
  }

  private async clientFor(serverId: string): Promise<NativeClient> {
    const connection = await this.repository.get(serverId);

    if (!connection) {
      throw new ServerNotFoundError();
    }

    return this.createNativeClient(
      connection.baseUrl,
      connection.adminPassword,
    );
  }
}
