import {
  PalDefenderClient,
  type PalDefenderPlayer,
  type PalDefenderPlayerDetails,
  type PalDefenderInventoryItem,
  type PalDefenderPal,
  type PalDefenderKickResult,
  type PalDefenderBanOptions,
  type PalDefenderBanResult,
  type PalDefenderBroadcastResult,
  type PalDefenderGuild,
  type PalDefenderBase,
  type PalDefenderBaseDetails,
  type PalDefenderGuildDetails,
} from "../clients/paldefender-client.js";

export interface PalDefenderStatus {
  connected: boolean;
  version: string;
  responseTime: number;
}

export class PalDefenderService {
  constructor(private readonly client: PalDefenderClient | null) {}

  async status(): Promise<PalDefenderStatus> {
    const startedAt = performance.now();

    if (!this.client) {
      return { connected: false, version: "Not configured", responseTime: 0 };
    }

    try {
      const version = await this.client.getVersion();
      return {
        connected: true,
        version,
        responseTime: Math.max(1, Math.round(performance.now() - startedAt)),
      };
    } catch {
      return {
        connected: false,
        version: "Unavailable",
        responseTime: Math.max(1, Math.round(performance.now() - startedAt)),
      };
    }
  }

  async players(): Promise<PalDefenderPlayer[]> {
    if (!this.client) {
      throw new PalDefenderNotConfiguredError();
    }
    return this.client.getPlayers();
  }

  async player(id: string): Promise<PalDefenderPlayerDetails> {
    return this.configuredClient().getPlayer(id);
  }

  async inventory(id: string): Promise<PalDefenderInventoryItem[]> {
    return this.configuredClient().getInventory(id);
  }

  async pals(id: string): Promise<PalDefenderPal[]> {
    return this.configuredClient().getPals(id);
  }

  async technology(id: string): Promise<string[]> {
    return this.configuredClient().getTechnology(id);
  }

  async guilds(): Promise<PalDefenderGuild[]> {
    return this.configuredClient().getGuilds();
  }

  async bases(): Promise<PalDefenderBase[]> {
    return this.configuredClient().getBases();
  }

  async base(id: string): Promise<PalDefenderBaseDetails> {
    return this.configuredClient().getBase(id);
  }

  async guild(id: string): Promise<PalDefenderGuildDetails> {
    return this.configuredClient().getGuild(id);
  }

  async kick(id: string, message?: string): Promise<PalDefenderKickResult> {
    return this.configuredClient().kickPlayer(id, message);
  }

  async ban(
    id: string,
    options?: PalDefenderBanOptions,
  ): Promise<PalDefenderBanResult> {
    return this.configuredClient().banPlayer(id, options);
  }

  async broadcast(message: string): Promise<PalDefenderBroadcastResult> {
    return this.configuredClient().broadcast(message);
  }

  private configuredClient(): PalDefenderClient {
    if (!this.client) throw new PalDefenderNotConfiguredError();
    return this.client;
  }
}

export class PalDefenderNotConfiguredError extends Error {
  constructor() {
    super("Set PALDEFENDER_URL and PALDEFENDER_TOKEN to use PalDefender.");
    this.name = "PalDefenderNotConfiguredError";
  }
}
