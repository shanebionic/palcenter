import {
  PalDefenderClient,
  PalDefenderError,
  type PalDefenderBanOptions,
  type PalDefenderBanResult,
  type PalDefenderBase,
  type PalDefenderBaseDetails,
  type PalDefenderBroadcastResult,
  type PalDefenderPlayerMessageResult,
  type PalDefenderPlayerMessageType,
  type PalDefenderReloadConfigResult,
  type PalDefenderDeleteBaseResult,
  type PalDefenderGiveItemsResult,
  type PalDefenderGivePalsResult,
  type PalDefenderGivePalTemplatesResult,
  type PalDefenderGivePalEggsResult,
  type PalDefenderGuild,
  type PalDefenderGuildDetails,
  type PalDefenderInventoryItem,
  type PalDefenderItemGrant,
  type PalDefenderKickResult,
  type PalDefenderModerationResult,
  type PalDefenderModerationState,
  type PalDefenderPal,
  type PalDefenderPalGrant,
  type PalDefenderPalEggGrant,
  type PalDefenderPlayer,
  type PalDefenderPlayerDetails,
  type PalDefenderProgression,
  type PalDefenderProgressionGrant,
  type PalDefenderGiveProgressionResult,
  type PalDefenderTechnologyMutationResult,
  type PalDefenderTechnologySelection,
} from "../clients/paldefender-client.js";
import type { ConnectionRepository } from "../repositories/connection-repository.js";
import type { CredentialRepository } from "../repositories/credential-repository.js";
import type { StoredConnection } from "../types/connections.js";
import type { PalDefenderCredentialSource } from "../types/credentials.js";

export interface PalDefenderStatus {
  state:
    | "disabled"
    | "configuration_required"
    | "connected"
    | "authentication_failed"
    | "permission_failed"
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

export interface PalDefenderActor {
  userId: string;
  onCredentialSource?: (source: PalDefenderCredentialSource) => void;
}

type ClientFactory = (endpoint: string, token: string) => PalDefenderClient;

export class PalDefenderService {
  private readonly progressionLevels = new Map<
    string,
    { level: number; expiresAt: number }
  >();

  constructor(
    private readonly repository: ConnectionRepository,
    private readonly createClient: ClientFactory = (endpoint, token) =>
      new PalDefenderClient(endpoint, token),
    private readonly credentialRepository: CredentialRepository | null = null,
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
        error instanceof PalDefenderError && error.statusCode === 401
          ? "authentication_failed"
          : error instanceof PalDefenderError && error.statusCode === 403
            ? "permission_failed"
            : error instanceof PalDefenderError &&
                (error.code === "MALFORMED_RESPONSE" ||
                  error.statusCode === 502)
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

  async players(
    serverId: string,
    actor?: PalDefenderActor,
  ): Promise<PalDefenderPlayer[]> {
    const players = await (
      await this.clientForServer(serverId, actor)
    ).getPlayers();
    return players.map((player) => ({
      ...player,
      level: this.cachedLevel(serverId, player.playerId) ?? player.level,
    }));
  }

  async player(
    serverId: string,
    id: string,
    actor?: PalDefenderActor,
  ): Promise<PalDefenderPlayerDetails> {
    const player = await (
      await this.clientForServer(serverId, actor)
    ).getPlayer(id);
    return {
      ...player,
      level: this.cachedLevel(serverId, player.playerId) ?? player.level,
    };
  }

  async inventory(
    serverId: string,
    id: string,
    actor?: PalDefenderActor,
  ): Promise<PalDefenderInventoryItem[]> {
    return (await this.clientForServer(serverId, actor)).getInventory(id);
  }

  async pals(
    serverId: string,
    id: string,
    actor?: PalDefenderActor,
  ): Promise<PalDefenderPal[]> {
    return (await this.clientForServer(serverId, actor)).getPals(id);
  }

  async technology(
    serverId: string,
    id: string,
    actor?: PalDefenderActor,
  ): Promise<string[]> {
    return (await this.clientForServer(serverId, actor)).getTechnology(id);
  }

  async learnTechnology(
    serverId: string,
    id: string,
    technology: PalDefenderTechnologySelection,
    actor?: PalDefenderActor,
  ): Promise<PalDefenderTechnologyMutationResult> {
    return (await this.clientForServer(serverId, actor)).learnTechnology(
      id,
      technology,
    );
  }

  async forgetTechnology(
    serverId: string,
    id: string,
    technology: PalDefenderTechnologySelection,
    actor?: PalDefenderActor,
  ): Promise<PalDefenderTechnologyMutationResult> {
    return (await this.clientForServer(serverId, actor)).forgetTechnology(
      id,
      technology,
    );
  }

  async progression(
    serverId: string,
    id: string,
    actor?: PalDefenderActor,
  ): Promise<PalDefenderProgression> {
    const progression = await (
      await this.clientForServer(serverId, actor)
    ).getProgression(id);
    this.progressionLevels.set(this.levelKey(serverId, id), {
      level: progression.character.level,
      expiresAt: Date.now() + 5 * 60_000,
    });
    this.progressionLevels.set(this.levelKey(serverId, progression.playerId), {
      level: progression.character.level,
      expiresAt: Date.now() + 5 * 60_000,
    });
    return progression;
  }

  async giveProgression(
    serverId: string,
    id: string,
    grant: PalDefenderProgressionGrant,
    actor?: PalDefenderActor,
  ): Promise<PalDefenderGiveProgressionResult> {
    const result = await (
      await this.clientForServer(serverId, actor)
    ).giveProgression(id, grant);
    this.progressionLevels.delete(this.levelKey(serverId, id));
    return result;
  }

  private levelKey(serverId: string, playerId: string): string {
    return `${serverId}:${playerId.replaceAll("-", "").toLowerCase()}`;
  }

  private cachedLevel(serverId: string, playerId: string): number | null {
    const key = this.levelKey(serverId, playerId);
    const cached = this.progressionLevels.get(key);
    if (!cached) return null;
    if (cached.expiresAt <= Date.now()) {
      this.progressionLevels.delete(key);
      return null;
    }
    return cached.level;
  }

  async guilds(
    serverId: string,
    actor?: PalDefenderActor,
  ): Promise<PalDefenderGuild[]> {
    return (await this.clientForServer(serverId, actor)).getGuilds();
  }

  async bases(
    serverId: string,
    actor?: PalDefenderActor,
  ): Promise<PalDefenderBase[]> {
    return (await this.clientForServer(serverId, actor)).getBases();
  }

  async base(
    serverId: string,
    id: string,
    actor?: PalDefenderActor,
  ): Promise<PalDefenderBaseDetails> {
    return (await this.clientForServer(serverId, actor)).getBase(id);
  }

  async deleteBase(
    serverId: string,
    id: string,
    actor?: PalDefenderActor,
  ): Promise<PalDefenderDeleteBaseResult> {
    return (await this.clientForServer(serverId, actor)).deleteBase(id);
  }

  async guild(
    serverId: string,
    id: string,
    actor?: PalDefenderActor,
  ): Promise<PalDefenderGuildDetails> {
    return (await this.clientForServer(serverId, actor)).getGuild(id);
  }

  async kick(
    serverId: string,
    id: string,
    message?: string,
    actor?: PalDefenderActor,
  ): Promise<PalDefenderKickResult> {
    return (await this.clientForServer(serverId, actor)).kickPlayer(
      id,
      message,
    );
  }

  async ban(
    serverId: string,
    id: string,
    options?: PalDefenderBanOptions,
    actor?: PalDefenderActor,
  ): Promise<PalDefenderBanResult> {
    return (await this.clientForServer(serverId, actor)).banPlayer(id, options);
  }

  async banlist(
    serverId: string,
    actor?: PalDefenderActor,
  ): Promise<PalDefenderModerationState> {
    return (await this.clientForServer(serverId, actor)).getBanlist();
  }

  async unbanUser(
    serverId: string,
    userId: string,
    reason?: string,
    actor?: PalDefenderActor,
  ): Promise<PalDefenderModerationResult> {
    return (await this.clientForServer(serverId, actor)).unbanUser(
      userId,
      reason,
    );
  }

  async banIp(
    serverId: string,
    ip: string,
    reason?: string,
    actor?: PalDefenderActor,
  ): Promise<PalDefenderModerationResult> {
    return (await this.clientForServer(serverId, actor)).banIp(ip, reason);
  }

  async unbanIp(
    serverId: string,
    ip: string,
    reason?: string,
    actor?: PalDefenderActor,
  ): Promise<PalDefenderModerationResult> {
    return (await this.clientForServer(serverId, actor)).unbanIp(ip, reason);
  }

  async broadcast(
    serverId: string,
    message: string,
    actor?: PalDefenderActor,
  ): Promise<PalDefenderBroadcastResult> {
    return (await this.clientForServer(serverId, actor)).broadcast(message);
  }

  async alert(
    serverId: string,
    message: string,
    actor?: PalDefenderActor,
  ): Promise<PalDefenderBroadcastResult> {
    return (await this.clientForServer(serverId, actor)).alert(message);
  }

  async reloadConfig(
    serverId: string,
    actor?: PalDefenderActor,
  ): Promise<PalDefenderReloadConfigResult> {
    return (await this.clientForServer(serverId, actor)).reloadConfig();
  }

  async sendPlayerMessage(
    serverId: string,
    userIds: string[],
    sendType: PalDefenderPlayerMessageType,
    message: string,
    actor?: PalDefenderActor,
  ): Promise<PalDefenderPlayerMessageResult> {
    return (await this.clientForServer(serverId, actor)).sendPlayerMessage(
      userIds,
      sendType,
      message,
    );
  }

  async giveItems(
    serverId: string,
    id: string,
    items: PalDefenderItemGrant[],
    actor?: PalDefenderActor,
  ): Promise<PalDefenderGiveItemsResult> {
    return (await this.clientForServer(serverId, actor)).giveItems(id, items);
  }

  async givePals(
    serverId: string,
    id: string,
    pals: PalDefenderPalGrant[],
    actor?: PalDefenderActor,
  ): Promise<PalDefenderGivePalsResult> {
    return (await this.clientForServer(serverId, actor)).givePals(id, pals);
  }

  async givePalTemplates(
    serverId: string,
    id: string,
    palTemplates: string[],
    actor?: PalDefenderActor,
  ): Promise<PalDefenderGivePalTemplatesResult> {
    return (await this.clientForServer(serverId, actor)).givePalTemplates(
      id,
      palTemplates,
    );
  }

  async givePalEggs(
    serverId: string,
    id: string,
    palEggs: PalDefenderPalEggGrant[],
    actor?: PalDefenderActor,
  ): Promise<PalDefenderGivePalEggsResult> {
    return (await this.clientForServer(serverId, actor)).givePalEggs(
      id,
      palEggs,
    );
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

  private async clientForServer(
    serverId: string,
    actor?: PalDefenderActor,
  ): Promise<PalDefenderClient> {
    const connection = await this.requireConnection(serverId);
    if (!(connection.palDefenderEnabled ?? false)) {
      throw new PalDefenderDisabledError();
    }
    if (!connection.palDefenderEndpoint || !connection.palDefenderToken) {
      throw new PalDefenderConfigurationRequiredError();
    }
    let credentialSource: PalDefenderCredentialSource = "server_default";
    let token = connection.palDefenderToken;
    if (actor && this.credentialRepository) {
      const assigned = this.credentialRepository.getForUser(
        serverId,
        actor.userId,
      );
      if (assigned) {
        token = assigned.token;
        credentialSource = "user";
      }
    }
    if (actor?.onCredentialSource) {
      actor.onCredentialSource(credentialSource);
    }
    return this.createClient(connection.palDefenderEndpoint, token);
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
