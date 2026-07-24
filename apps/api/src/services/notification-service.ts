import { randomBytes } from "node:crypto";
import { DiscordNotificationProvider } from "../providers/discord-notification-provider.js";
import { NtfyNotificationProvider } from "../providers/ntfy-notification-provider.js";
import type { NotificationProvider } from "../providers/notification-provider.js";
import type { ConnectionRepository } from "../repositories/connection-repository.js";
import type { NotificationRepository } from "../repositories/notification-repository.js";
import type { ServerEvent } from "../types/connections.js";
import type {
  NotificationConfiguration,
  NotificationConfigurationInput,
  NotificationConfigurationUpdate,
  NotificationMessage,
  PublicNotificationConfiguration,
} from "../types/notifications.js";

export class NotificationNotFoundError extends Error {
  constructor() {
    super("The requested notification provider does not exist.");
    this.name = "NotificationNotFoundError";
  }
}

export class NotificationConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotificationConfigurationError";
  }
}

export interface NotificationDeliveryFailure {
  providerId: string;
  providerName: string;
  error: unknown;
}

export class NotificationService {
  constructor(
    private readonly repository: NotificationRepository,
    private readonly connections: ConnectionRepository,
    private readonly onDeliveryFailure: (
      failure: NotificationDeliveryFailure,
    ) => void,
  ) {}

  async list(): Promise<PublicNotificationConfiguration[]> {
    return (await this.repository.list()).map((configuration) =>
      this.sanitize(configuration),
    );
  }

  async create(
    input: NotificationConfigurationInput,
  ): Promise<PublicNotificationConfiguration> {
    const now = new Date().toISOString();
    const configuration: NotificationConfiguration = {
      ...input,
      id: `ntf_${randomBytes(8).toString("hex")}`,
      createdAt: now,
      updatedAt: now,
    };

    await this.repository.create(configuration);
    return this.sanitize(configuration);
  }

  async update(
    id: string,
    input: NotificationConfigurationUpdate,
  ): Promise<PublicNotificationConfiguration> {
    const existing = await this.requireConfiguration(id);
    const configuration = this.updatedConfiguration(existing, input);

    await this.repository.update(configuration);
    return this.sanitize(configuration);
  }

  async delete(id: string): Promise<void> {
    await this.requireConfiguration(id);
    await this.repository.delete(id);
  }

  async test(id: string): Promise<void> {
    const configuration = await this.requireConfiguration(id);
    await this.provider(configuration).send({
      title: "PalCenter test notification",
      body: `The ${configuration.name} notification provider is configured correctly.`,
    });
  }

  async handle(events: ServerEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    const configurations = (await this.repository.list()).filter(
      (configuration) => configuration.enabled,
    );

    await Promise.all(
      events.map(async (event) => {
        const connection = await this.connections.get(event.serverId);
        const message = this.eventMessage(
          event,
          connection?.name ?? event.serverId,
        );
        const matching = configurations.filter((configuration) =>
          configuration.events.includes(event.type),
        );

        await Promise.all(
          matching.map(async (configuration) => {
            try {
              await this.provider(configuration).send(message);
            } catch (error) {
              this.onDeliveryFailure({
                providerId: configuration.id,
                providerName: configuration.name,
                error,
              });
            }
          }),
        );
      }),
    );
  }

  private async requireConfiguration(
    id: string,
  ): Promise<NotificationConfiguration> {
    const configuration = await this.repository.get(id);

    if (!configuration) {
      throw new NotificationNotFoundError();
    }

    return configuration;
  }

  private updatedConfiguration(
    existing: NotificationConfiguration,
    input: NotificationConfigurationUpdate,
  ): NotificationConfiguration {
    const base = {
      id: existing.id,
      name: input.name,
      enabled: input.enabled,
      events: input.events,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    if (input.type === "ntfy") {
      return {
        ...base,
        type: "ntfy",
        serverUrl: input.serverUrl,
        topic: input.topic,
      };
    }

    const webhookUrl =
      input.webhookUrl ??
      (existing.type === "discord" ? existing.webhookUrl : undefined);

    if (!webhookUrl) {
      throw new NotificationConfigurationError(
        "A Discord webhook URL is required.",
      );
    }

    return {
      ...base,
      type: "discord",
      webhookUrl,
    };
  }

  private provider(
    configuration: NotificationConfiguration,
  ): NotificationProvider {
    if (configuration.type === "discord") {
      return new DiscordNotificationProvider(configuration.webhookUrl);
    }

    return new NtfyNotificationProvider(
      configuration.serverUrl,
      configuration.topic,
    );
  }

  private sanitize(
    configuration: NotificationConfiguration,
  ): PublicNotificationConfiguration {
    if (configuration.type === "discord") {
      const { webhookUrl, ...publicConfiguration } = configuration;
      return {
        ...publicConfiguration,
        webhookConfigured: Boolean(webhookUrl),
      };
    }

    const serverUrl = new URL(configuration.serverUrl);
    serverUrl.username = "";
    serverUrl.password = "";
    serverUrl.search = "";
    serverUrl.hash = "";

    return {
      ...configuration,
      serverUrl: serverUrl.toString().replace(/\/$/, ""),
    };
  }

  private eventMessage(
    event: ServerEvent,
    serverName: string,
  ): NotificationMessage {
    const playerName = event.playerName ?? "A player";

    switch (event.type) {
      case "server_online":
        return {
          title: `${serverName} is online`,
          body: "The Palworld server came online.",
        };
      case "server_offline":
        return {
          title: `${serverName} is offline`,
          body: "The Palworld server stopped responding.",
        };
      case "server_restarted":
        return {
          title: `${serverName} restarted`,
          body: "The Palworld server uptime indicates a restart.",
        };
      case "player_joined":
        return {
          title: `Player joined ${serverName}`,
          body: `${playerName} joined the server.`,
        };
      case "player_left":
        return {
          title: `Player left ${serverName}`,
          body: `${playerName} left the server.`,
        };
      case "player_banned":
        return {
          title: `Player banned from ${serverName}`,
          body: `${playerName} was banned from the server.`,
        };
    }
  }
}
