import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { JsonConnectionRepository } from "../repositories/json-connection-repository.js";
import { JsonNotificationRepository } from "../repositories/json-notification-repository.js";
import { SqliteUserRepository } from "../repositories/sqlite-user-repository.js";
import {
  createTarGzip,
  extractTarGzip,
  type ArchiveEntry,
} from "./tar-gzip-archive.js";
import { PasswordService } from "./password-service.js";

const legacyFiles = [
  "metadata.json",
  "servers.json",
  "notifications.json",
  "history.sqlite",
] as const;
const currentFiles = [...legacyFiles, "users.sqlite"] as const;
const formatVersion = 2;

const metadataSchema = z
  .object({
    formatVersion: z.union([z.literal(1), z.literal(formatVersion)]),
    palcenterVersion: z.string().min(1).max(50),
    createdAt: z.string().datetime(),
  })
  .strict();

export type BackupMetadata = z.infer<typeof metadataSchema>;

export interface BackupInfo {
  applicationVersion: string;
  backupFormatVersion: number;
  compatibleFormatVersions: number[];
  data: Record<
    "servers" | "notifications" | "history" | "users",
    {
      available: boolean;
      sizeBytes: number | null;
    }
  >;
}

export interface BackupArtifact {
  contents: Buffer;
  filename: string;
  metadata: BackupMetadata;
}

export class InvalidBackupError extends Error {}
export class BackupRestoreError extends Error {}

interface BackupLifecycle {
  pause(): Promise<void>;
  resume(): Promise<void>;
}

export class BackupService {
  private operation: Promise<void> = Promise.resolve();
  private dataUnavailable = false;
  private readonly directory: string;

  constructor(
    configDirectory: string,
    private readonly applicationVersion: string,
    private readonly lifecycle: BackupLifecycle,
  ) {
    this.directory = path.resolve(configDirectory);
  }

  async info(): Promise<BackupInfo> {
    const status = async (filename: string) => {
      try {
        const details = await fs.stat(path.join(this.directory, filename));
        return { available: details.isFile(), sizeBytes: details.size };
      } catch {
        return { available: false, sizeBytes: null };
      }
    };

    const [servers, notifications, history, users] = await Promise.all([
      status("servers.json"),
      status("notifications.json"),
      status("history.sqlite"),
      status("users.sqlite"),
    ]);

    return {
      applicationVersion: this.applicationVersion,
      backupFormatVersion: formatVersion,
      compatibleFormatVersions: [1, formatVersion],
      data: { servers, notifications, history, users },
    };
  }

  isDataUnavailable(): boolean {
    return this.dataUnavailable;
  }

  create(): Promise<BackupArtifact> {
    return this.exclusive(async () => {
      this.dataUnavailable = true;

      try {
        await this.lifecycle.pause();
        const metadata: BackupMetadata = {
          formatVersion,
          palcenterVersion: this.applicationVersion,
          createdAt: new Date().toISOString(),
        };
        const entries: ArchiveEntry[] = [
          {
            name: "metadata.json",
            contents: Buffer.from(`${JSON.stringify(metadata, null, 2)}\n`),
          },
        ];

        for (const filename of currentFiles.slice(1)) {
          entries.push({
            name: filename,
            contents: await fs.readFile(path.join(this.directory, filename)),
          });
        }

        return {
          contents: createTarGzip(entries),
          filename: `palcenter-backup-${metadata.createdAt.slice(0, 10)}.tar.gz`,
          metadata,
        };
      } finally {
        try {
          await this.lifecycle.resume();
        } finally {
          this.dataUnavailable = false;
        }
      }
    });
  }

  restore(archive: Buffer): Promise<BackupMetadata> {
    return this.exclusive(async () => {
      const stagedDirectory = await fs.mkdtemp(
        path.join(this.directory, ".restore-stage-"),
      );

      try {
        const metadata = await this.validateAndStage(archive, stagedDirectory);
        this.dataUnavailable = true;
        await this.lifecycle.pause();

        try {
          await this.replaceFrom(
            stagedDirectory,
            metadata.formatVersion === 1
              ? legacyFiles.slice(1)
              : currentFiles.slice(1),
          );
        } catch (error) {
          await this.lifecycle.resume().catch(() => undefined);
          throw error;
        }

        return metadata;
      } finally {
        this.dataUnavailable = false;
        await fs.rm(stagedDirectory, { recursive: true, force: true });
      }
    });
  }

  private async validateAndStage(
    archive: Buffer,
    stagedDirectory: string,
  ): Promise<BackupMetadata> {
    let entries: Map<string, Buffer>;
    try {
      entries = extractTarGzip(archive);
    } catch (error) {
      throw new InvalidBackupError(
        error instanceof Error ? error.message : "The archive is invalid.",
      );
    }

    let metadata: BackupMetadata;
    try {
      metadata = metadataSchema.parse(
        JSON.parse(entries.get("metadata.json")!.toString("utf8")),
      );
    } catch {
      throw new InvalidBackupError(
        "Backup metadata is missing, invalid, or incompatible.",
      );
    }

    const expectedFiles =
      metadata.formatVersion === 1 ? legacyFiles : currentFiles;
    if (
      entries.size !== expectedFiles.length ||
      expectedFiles.some((filename) => !entries.has(filename))
    ) {
      throw new InvalidBackupError(
        metadata.formatVersion === 1
          ? "Format v1 backup must contain its four required files only."
          : "Backup must contain metadata, server, notification, history, and user data only.",
      );
    }

    for (const filename of expectedFiles.slice(1)) {
      await fs.writeFile(
        path.join(stagedDirectory, filename),
        entries.get(filename)!,
        { flag: "wx", mode: 0o600 },
      );
    }

    try {
      await new JsonConnectionRepository(stagedDirectory).list();
      await new JsonNotificationRepository(stagedDirectory).list();
      this.validateDatabase(path.join(stagedDirectory, "history.sqlite"));
      if (metadata.formatVersion === formatVersion) {
        const users = new SqliteUserRepository(stagedDirectory);
        try {
          users.initialize();
          const storedUsers = users.list();
          if (
            users.setupRequired() ||
            !storedUsers.some(
              (user) => user.enabled && user.role === "administrator",
            ) ||
            storedUsers.some(
              (user) =>
                !new PasswordService().isSupportedHash(user.passwordHash),
            )
          ) {
            throw new Error("Backup user data is not safe to restore.");
          }
        } finally {
          users.close();
        }
      }
    } catch {
      throw new InvalidBackupError(
        "Backup data failed configuration or database validation.",
      );
    }

    return metadata;
  }

  private validateDatabase(databasePath: string): void {
    const database = new DatabaseSync(databasePath, { readOnly: true });
    try {
      const integrity = database.prepare("PRAGMA quick_check").get() as
        | { quick_check: string }
        | undefined;
      const version = database.prepare("PRAGMA user_version").get() as
        | { user_version: number }
        | undefined;
      const tables = database
        .prepare(
          `SELECT name FROM sqlite_master
           WHERE type = 'table' AND name IN (
             'server_metrics', 'server_events', 'active_players'
           )`,
        )
        .all() as unknown as Array<{ name: string }>;

      if (
        integrity?.quick_check !== "ok" ||
        version?.user_version !== 1 ||
        tables.length !== 3
      ) {
        throw new Error("SQLite validation failed.");
      }
    } finally {
      database.close();
    }
  }

  private async replaceFrom(
    stagedDirectory: string,
    filenames: readonly string[],
  ): Promise<void> {
    const token = randomUUID();
    const rollbackPaths = new Map<string, string>();
    const installed: string[] = [];

    try {
      for (const filename of filenames) {
        const target = path.join(this.directory, filename);
        const rollback = path.join(this.directory, `.${filename}.${token}.bak`);
        await fs.rename(target, rollback);
        rollbackPaths.set(filename, rollback);
      }

      for (const filename of filenames) {
        await fs.rename(
          path.join(stagedDirectory, filename),
          path.join(this.directory, filename),
        );
        installed.push(filename);
      }
    } catch (error) {
      for (const filename of installed.reverse()) {
        await fs.rm(path.join(this.directory, filename), { force: true });
      }
      for (const [filename, rollback] of rollbackPaths) {
        await fs.rename(rollback, path.join(this.directory, filename));
      }
      throw new BackupRestoreError(
        "Restore failed; existing data was preserved.",
      );
    }

    try {
      await this.lifecycle.resume();
    } catch {
      for (const filename of installed.reverse()) {
        await fs.rm(path.join(this.directory, filename), { force: true });
      }
      for (const [filename, rollback] of rollbackPaths) {
        await fs.rename(rollback, path.join(this.directory, filename));
      }
      throw new BackupRestoreError(
        "Restored data could not be opened; existing data was recovered.",
      );
    }

    for (const rollback of rollbackPaths.values()) {
      await fs.rm(rollback, { force: true }).catch(() => undefined);
    }
  }

  private exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operation.then(operation, operation);
    this.operation = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}
