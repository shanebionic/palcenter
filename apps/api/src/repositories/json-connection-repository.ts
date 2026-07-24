import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { ConnectionFile, StoredConnection } from "../types/connections.js";
import type { ConnectionRepository } from "./connection-repository.js";
import {
  tightenFilePermissions,
  type StoragePermissionWarningHandler,
} from "../services/storage-initialization-service.js";

const storedConnectionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  baseUrl: z.string().url(),
  adminPassword: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const connectionFileSchema = z.object({
  version: z.literal(1),
  servers: z.array(storedConnectionSchema),
});

export class JsonConnectionRepository implements ConnectionRepository {
  private readonly filePath: string;

  constructor(
    configDirectory: string,
    private readonly onPermissionWarning: StoragePermissionWarningHandler = () =>
      undefined,
  ) {
    this.filePath = path.join(path.resolve(configDirectory), "servers.json");
  }

  async initialize(): Promise<void> {
    const directory = path.dirname(this.filePath);
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });

    try {
      await fs.access(this.filePath);
      await tightenFilePermissions(this.filePath, this.onPermissionWarning);
    } catch (error) {
      if (!this.isMissing(error)) throw error;
      await this.write({
        version: 1,
        servers: [],
      });
    }
  }

  async list(): Promise<StoredConnection[]> {
    const file = await this.read();
    return file.servers.map((server) => ({ ...server }));
  }

  async get(id: string): Promise<StoredConnection | null> {
    const file = await this.read();
    const connection = file.servers.find((server) => server.id === id);

    return connection ? { ...connection } : null;
  }

  async create(connection: StoredConnection): Promise<void> {
    const file = await this.read();

    if (file.servers.some((server) => server.id === connection.id)) {
      throw new Error(`Connection "${connection.id}" already exists.`);
    }

    file.servers.push({ ...connection });
    await this.write(file);
  }

  async delete(id: string): Promise<void> {
    const file = await this.read();
    const servers = file.servers.filter((server) => server.id !== id);

    if (servers.length === file.servers.length) {
      throw new Error(`Connection "${id}" was not found.`);
    }

    await this.write({
      version: 1,
      servers,
    });
  }

  private async read(): Promise<ConnectionFile> {
    await this.initialize();

    const text = await fs.readFile(this.filePath, "utf8");
    const json: unknown = JSON.parse(text);

    return connectionFileSchema.parse(json);
  }

  private async write(file: ConnectionFile): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), {
      recursive: true,
      mode: 0o700,
    });

    const validated = connectionFileSchema.parse(file);
    const temporaryPath = `${this.filePath}.tmp`;

    await fs.writeFile(
      temporaryPath,
      `${JSON.stringify(validated, null, 2)}\n`,
      { encoding: "utf8", mode: 0o600 },
    );

    await fs.rename(temporaryPath, this.filePath);
    await tightenFilePermissions(this.filePath, this.onPermissionWarning);
  }

  private isMissing(error: unknown): boolean {
    return (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    );
  }
}
