import { PalworldRestClient } from "../clients/palworld-rest-client.js";
import type { ConnectionRepository } from "../repositories/connection-repository.js";
import type {
  PalworldServerSettings,
  ServerSettingsView,
} from "../types/connections.js";

export class SettingsServerNotFoundError extends Error {
  constructor() {
    super("The requested server does not exist.");
    this.name = "SettingsServerNotFoundError";
  }
}

export class ServerSettingsService {
  constructor(private readonly repository: ConnectionRepository) {}

  async get(serverId: string): Promise<ServerSettingsView> {
    const connection = await this.repository.get(serverId);

    if (!connection) {
      throw new SettingsServerNotFoundError();
    }

    const client = new PalworldRestClient(
      connection.baseUrl,
      connection.adminPassword,
    );
    const [info, settings] = await Promise.all([
      client.getInfo(),
      client.getSettings(),
    ]);

    return {
      general: {
        serverName:
          this.textOrNull(info.servername) ??
          this.textOrNull(settings.ServerName),
        description:
          this.textOrNull(info.description) ??
          this.textOrNull(settings.ServerDescription),
        version: this.textOrNull(info.version),
        region: this.textOrNull(settings.Region),
      },
      gameplay: {
        difficulty: this.textOrNull(settings.Difficulty),
        experienceMultiplier: settings.ExpRate ?? null,
        captureRate: settings.PalCaptureRate ?? null,
        collectionDropRate: settings.CollectionDropRate ?? null,
        enemyDropRate: settings.EnemyDropItemRate ?? null,
        daySpeed: settings.DayTimeSpeedRate ?? null,
        nightSpeed: settings.NightTimeSpeedRate ?? null,
        deathPenalty: this.textOrNull(settings.DeathPenalty),
      },
      server: {
        maxPlayers: settings.ServerPlayerMaxNum ?? null,
        publicIp: this.textOrNull(settings.PublicIP),
        publicPort: settings.PublicPort ?? null,
        restApiPort: settings.RESTAPIPort ?? null,
        rconEnabled: settings.RCONEnabled ?? null,
        rconPort: settings.RCONPort ?? null,
      },
      security: {
        passwordProtected: this.passwordProtected(settings),
      },
      crossplay: {
        platforms: this.crossplayPlatforms(settings),
      },
    };
  }

  private passwordProtected(settings: PalworldServerSettings): boolean | null {
    return settings.bUseAuth ?? null;
  }

  private crossplayPlatforms(
    settings: PalworldServerSettings,
  ): string[] | null {
    const value = settings.CrossplayPlatforms ?? settings.AllowConnectPlatform;

    if (Array.isArray(value)) {
      const platforms = value.map((item) => item.trim()).filter(Boolean);
      return platforms.length > 0 ? platforms : null;
    }

    const text = value?.trim();

    if (!text) {
      return null;
    }

    const platforms = text
      .replace(/^\(|\)$/g, "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    return platforms.length > 0 ? platforms : null;
  }

  private textOrNull(value: string | undefined): string | null {
    const text = value?.trim();
    return text ? text : null;
  }
}
