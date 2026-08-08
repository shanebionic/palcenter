import {
  PalDefenderClient,
  PalDefenderError,
  type PalDefenderBanOptions,
  type PalDefenderBanResult,
  type PalDefenderBase,
  type PalDefenderBaseDetails,
  type PalDefenderBroadcastResult,
  type PalDefenderGiveItemsResult,
  type PalDefenderGivePalsResult,
  type PalDefenderGuild,
  type PalDefenderGuildDetails,
  type PalDefenderInventoryItem,
  type PalDefenderItemGrant,
  type PalDefenderKickResult,
  type PalDefenderPal,
  type PalDefenderPalGrant,
  type PalDefenderPlayer,
  type PalDefenderPlayerDetails,
} from "../clients/paldefender-client.js";
import type { ConnectionRepository } from "../repositories/connection-repository.js";
import type { StoredConnection } from "../types/connections.js";

export interface PalDefenderStatus {
  state:
    | "disabled"
    | "configuration_required"
    | "connected"
    | "authentication_failed"
    | "unreachable"
    | "invalid_response";
  enabled: boolean;
  configured: boolean;
  connected: boolean;
  version: string;
  responseTime: number;
}

export interface PalDefenderConnectionTestResult {
  connected: true;
  version: string;
  responseTime: number;
}

type ClientFactory = (endpoint: string, token: string) => PalDefenderClient;

export class PalDefenderService {
  constructor(
    private readonly repository: ConnectionRepository,
    private readonly createClient: ClientFactory = (endpoint, token) =>
      new PalDefenderClient(endpoint, token),
  ) {}

  async status(serverId: string): Promise<PalDefenderStatus> {
    const connection = await this.requireConnection(serverId);
    const enabled = connection.palDefenderEnabled ?? false;
    const configured = Boolean(
      connection.palDefenderEndpoint && connection.palDefenderToken,
    );
    if (!enabled) {
      return {
        state: "disabled",
        enabled: false,
        configured,
        connected: false,
        version: "Disabled",
        responseTime: 0,
      };
    }
    if (!configured) {
      return {
        state: "configuration_required",
        enabled: true,
        configured: false,
        connected: false,
        version: "Configuration required",
        responseTime: 0,
      };
    }
    try {
      const result = await this.testConnection(
        connection.palDefenderEndpoint!,
        connection.palDefenderToken!,
      );
      return { state: "connected", enabled: true, configured: true, ...result };
    } catch (error) {
      const state =
        error instanceof PalDefenderError &&
        (error.statusCode === 401 || error.statusCode === 403)
          ? "authentication_failed"
          : error instanceof PalDefenderError &&
              (error.code === "MALFORMED_RESPONSE" || error.statusCode === 502)
            ? "invalid_response"
            : "unreachable";
      return {
        state,
        enabled: true,
        configured: true,
        connected: false,
        version: "Unavailable",
        responseTime: 0,
      };
    }
  }

  async testForServer(
    serverId: string,
    endpoint: string,
    token?: string,
  ): Promise<PalDefenderConnectionTestResult> {
    const connection = await this.requireConnection(serverId);
    const selectedToken = token?.trim() || connection.palDefenderToken || "";
    if (!selectedToken) throw new PalDefenderConfigurationRequiredError();
    return this.testConnection(endpoint, selectedToken);
  }

  async players(serverId: string): Promise<PalDefenderPlayer[]> {
    return (await this.clientForServer(serverId)).getPlayers();
  }

  async player(
    serverId: string,
    id: string,
  ): Promise<PalDefenderPlayerDetails> {
    return (await this.clientForServer(serverId)).getPlayer(id);
  }

  async inventory(
    serverId: string,
    id: string,
  ): Promise<PalDefenderInventoryItem[]> {
    return (await this.clientForServer(serverId)).getInventory(id);
  }

  async pals(serverId: string, id: string): Promise<PalDefenderPal[]> {
    return (await this.clientForServer(serverId)).getPals(id);
  }

  async technology(serverId: string, id: string): Promise<string[]> {
    return (await this.clientForServer(serverId)).getTechnology(id);
  }

  async guilds(serverId: string): Promise<PalDefenderGuild[]> {
    return (await this.clientForServer(serverId)).getGuilds();
  }

  async bases(serverId: string): Promise<PalDefenderBase[]> {
    return (await this.clientForServer(serverId)).getBases();
  }

  async base(serverId: string, id: string): Promise<PalDefenderBaseDetails> {
    return (await this.clientForServer(serverId)).getBase(id);
  }

  async guild(serverId: string, id: string): Promise<PalDefenderGuildDetails> {
    return (await this.clientForServer(serverId)).getGuild(id);
  }

  async kick(
    serverId: string,
    id: string,
    message?: string,
  ): Promise<PalDefenderKickResult> {
    return (await this.clientForServer(serverId)).kickPlayer(id, message);
  }

  async ban(
    serverId: string,
    id: string,
    options?: PalDefenderBanOptions,
  ): Promise<PalDefenderBanResult> {
    return (await this.clientForServer(serverId)).banPlayer(id, options);
  }

  async broadcast(
    serverId: string,
    message: string,
  ): Promise<PalDefenderBroadcastResult> {
    return (await this.clientForServer(serverId)).broadcast(message);
  }

  async giveItems(
    serverId: string,
    id: string,
    items: PalDefenderItemGrant[],
  ): Promise<PalDefenderGiveItemsResult> {
    return (await this.clientForServer(serverId)).giveItems(id, items);
  }

  async givePals(
    serverId: string,
    id: string,
    pals: PalDefenderPalGrant[],
  ): Promise<PalDefenderGivePalsResult> {
    return (await this.clientForServer(serverId)).givePals(id, pals);
  }

  private async testConnection(
    endpoint: string,
    token: string,
  ): Promise<PalDefenderConnectionTestResult> {
    const startedAt = performance.now();
    const version = await this.createClient(endpoint, token).getVersion();
    return {
      connected: true,
      version,
      responseTime: Math.max(1, Math.round(performance.now() - startedAt)),
    };
  }

  private async clientForServer(serverId: string): Promise<PalDefenderClient> {
    const connection = await this.requireConnection(serverId);
    if (!(connection.palDefenderEnabled ?? false)) {
      throw new PalDefenderDisabledError();
    }
    if (!connection.palDefenderEndpoint || !connection.palDefenderToken) {
      throw new PalDefenderConfigurationRequiredError();
    }
    return this.createClient(
      connection.palDefenderEndpoint,
      connection.palDefenderToken,
    );
  }

  private async requireConnection(serverId: string): Promise<StoredConnection> {
    const connection = await this.repository.get(serverId);
    if (!connection) throw new PalDefenderServerNotFoundError();
    return connection;
  }
}

export class PalDefenderDisabledError extends Error {
  constructor() {
    super("PalDefender is not enabled for this server.");
    this.name = "PalDefenderDisabledError";
  }
}

export class PalDefenderConfigurationRequiredError extends Error {
  constructor() {
    super("Configure a PalDefender endpoint and bearer token for this server.");
    this.name = "PalDefenderConfigurationRequiredError";
  }
}

export class PalDefenderServerNotFoundError extends Error {
  constructor() {
    super("The requested server does not exist.");
    this.name = "PalDefenderServerNotFoundError";
  }
}
