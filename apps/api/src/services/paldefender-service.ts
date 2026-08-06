import {
  PalDefenderClient,
  type PalDefenderPlayer,
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
}

export class PalDefenderNotConfiguredError extends Error {
  constructor() {
    super("Set PALDEFENDER_URL and PALDEFENDER_TOKEN to use PalDefender.");
    this.name = "PalDefenderNotConfiguredError";
  }
}
