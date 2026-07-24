import { randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  tightenFilePermissions,
  type StoragePermissionWarningHandler,
} from "../services/storage-initialization-service.js";

const systemConfigurationSchema = z
  .object({
    version: z.literal(1),
    installationId: z.string().uuid(),
    sessionSecret: z.string().min(32).max(1_024),
    createdAt: z.string().datetime(),
  })
  .strict();

export type SystemConfiguration = z.infer<typeof systemConfigurationSchema>;
export type SystemConfigurationSource =
  | "stored"
  | "environment_migration"
  | "generated";

export interface SystemConfigurationResult {
  configuration: SystemConfiguration;
  source: SystemConfigurationSource;
}

export class SystemConfigurationRepository {
  private readonly directory: string;
  private readonly filePath: string;

  constructor(
    configDirectory: string,
    private readonly onPermissionWarning: StoragePermissionWarningHandler = () =>
      undefined,
  ) {
    this.directory = path.resolve(configDirectory);
    this.filePath = path.join(this.directory, "system.json");
  }

  async initialize(
    environmentSecret?: string,
  ): Promise<SystemConfigurationResult> {
    await fs.mkdir(this.directory, { recursive: true, mode: 0o700 });

    try {
      return {
        configuration: await this.read(),
        source: "stored",
      };
    } catch (error) {
      if (!this.isMissing(error)) {
        throw error;
      }
    }

    const configuration: SystemConfiguration = {
      version: 1,
      installationId: randomUUID(),
      sessionSecret: environmentSecret ?? randomBytes(48).toString("base64url"),
      createdAt: new Date().toISOString(),
    };
    const source: SystemConfigurationSource = environmentSecret
      ? "environment_migration"
      : "generated";

    try {
      const handle = await fs.open(this.filePath, "wx", 0o600);
      try {
        await handle.writeFile(
          `${JSON.stringify(
            systemConfigurationSchema.parse(configuration),
            null,
            2,
          )}\n`,
          "utf8",
        );
        await handle.sync();
      } finally {
        await handle.close();
      }
    } catch (error) {
      if (!this.isAlreadyExists(error)) {
        throw error;
      }
      return {
        configuration: await this.read(),
        source: "stored",
      };
    }

    await tightenFilePermissions(this.filePath, this.onPermissionWarning);
    return { configuration, source };
  }

  async read(): Promise<SystemConfiguration> {
    const text = await fs.readFile(this.filePath, "utf8");
    const configuration = systemConfigurationSchema.parse(JSON.parse(text));
    await tightenFilePermissions(this.filePath, this.onPermissionWarning);
    return configuration;
  }

  async validateFile(filePath: string): Promise<SystemConfiguration> {
    const text = await fs.readFile(filePath, "utf8");
    return systemConfigurationSchema.parse(JSON.parse(text));
  }

  private isMissing(error: unknown): boolean {
    return (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    );
  }

  private isAlreadyExists(error: unknown): boolean {
    return (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "EEXIST"
    );
  }
}
