import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { notificationEventTypes } from "../types/notifications.js";
import type {
  NotificationConfiguration,
  NotificationFile,
} from "../types/notifications.js";
import type { NotificationRepository } from "./notification-repository.js";

const baseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  enabled: z.boolean(),
  events: z.array(z.enum(notificationEventTypes)),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const configurationSchema = z.discriminatedUnion("type", [
  baseSchema.extend({
    type: z.literal("discord"),
    webhookUrl: z.string().url(),
  }),
  baseSchema.extend({
    type: z.literal("ntfy"),
    serverUrl: z.string().url(),
    topic: z.string().min(1),
  }),
]);

const notificationFileSchema = z.object({
  version: z.literal(1),
  providers: z.array(configurationSchema),
});

export class JsonNotificationRepository implements NotificationRepository {
  private readonly filePath: string;

  constructor(configDirectory: string) {
    this.filePath = path.join(
      path.resolve(configDirectory),
      "notifications.json",
    );
  }

  async initialize(): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });

    try {
      await fs.access(this.filePath);
    } catch {
      await this.write({ version: 1, providers: [] });
    }
  }

  async list(): Promise<NotificationConfiguration[]> {
    const file = await this.read();
    return file.providers.map((provider) => ({ ...provider }));
  }

  async get(id: string): Promise<NotificationConfiguration | null> {
    const file = await this.read();
    const provider = file.providers.find((item) => item.id === id);
    return provider ? { ...provider } : null;
  }

  async create(configuration: NotificationConfiguration): Promise<void> {
    const file = await this.read();

    if (file.providers.some((provider) => provider.id === configuration.id)) {
      throw new Error(`Notification provider "${configuration.id}" exists.`);
    }

    file.providers.push({ ...configuration });
    await this.write(file);
  }

  async update(configuration: NotificationConfiguration): Promise<void> {
    const file = await this.read();
    const index = file.providers.findIndex(
      (provider) => provider.id === configuration.id,
    );

    if (index === -1) {
      throw new Error(`Notification provider "${configuration.id}" not found.`);
    }

    file.providers[index] = { ...configuration };
    await this.write(file);
  }

  async delete(id: string): Promise<void> {
    const file = await this.read();
    const providers = file.providers.filter((provider) => provider.id !== id);

    if (providers.length === file.providers.length) {
      throw new Error(`Notification provider "${id}" not found.`);
    }

    await this.write({ version: 1, providers });
  }

  private async read(): Promise<NotificationFile> {
    await this.initialize();
    const json: unknown = JSON.parse(await fs.readFile(this.filePath, "utf8"));
    return notificationFileSchema.parse(json);
  }

  private async write(file: NotificationFile): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const validated = notificationFileSchema.parse(file);
    const temporaryPath = `${this.filePath}.tmp`;

    await fs.writeFile(
      temporaryPath,
      `${JSON.stringify(validated, null, 2)}\n`,
      "utf8",
    );
    await fs.rename(temporaryPath, this.filePath);
  }
}
