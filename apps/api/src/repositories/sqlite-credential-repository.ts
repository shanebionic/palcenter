import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { StoredPalDefenderCredential } from "../types/credentials.js";
import type { CredentialRepository } from "./credential-repository.js";
import {
  tightenFilePermissionsSync,
  type StoragePermissionWarningHandler,
} from "../services/storage-initialization-service.js";

interface CredentialRow {
  id: string;
  server_id: string;
  user_id: string;
  token: string;
  created_at: string;
  updated_at: string;
}

export class CredentialUserNotFoundError extends Error {}

export class SqliteCredentialRepository implements CredentialRepository {
  private database: DatabaseSync | null = null;
  private readonly databasePath: string;

  constructor(
    configDirectory: string,
    private readonly onPermissionWarning: StoragePermissionWarningHandler = () =>
      undefined,
  ) {
    const directory = path.resolve(configDirectory);
    this.databasePath = path.join(directory, "users.sqlite");
    this.open();
  }

  getForUser(
    serverId: string,
    userId: string,
  ): StoredPalDefenderCredential | null {
    const row = this.requireDatabase()
      .prepare(
        "SELECT * FROM paldefender_user_credentials WHERE server_id = ? AND user_id = ?",
      )
      .get(serverId, userId) as CredentialRow | undefined;
    return row ? this.credential(row) : null;
  }

  upsert(
    serverId: string,
    userId: string,
    token: string,
    id: string,
    now: string,
  ): StoredPalDefenderCredential {
    const database = this.requireDatabase();
    try {
      database
        .prepare(
          `INSERT INTO paldefender_user_credentials (
            id, server_id, user_id, token, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT (server_id, user_id) DO UPDATE SET
            id = excluded.id,
            token = excluded.token,
            updated_at = excluded.updated_at`,
        )
        .run(id, serverId, userId, token, now, now);
    } catch (error) {
      if (error instanceof Error && /FOREIGN KEY/i.test(error.message)) {
        throw new CredentialUserNotFoundError("User not found.");
      }
      throw error;
    }
    const saved = this.getForUser(serverId, userId);
    if (!saved) throw new Error("PalDefender credential was not saved.");
    return saved;
  }

  removeForUser(serverId: string, userId: string): void {
    this.requireDatabase()
      .prepare(
        "DELETE FROM paldefender_user_credentials WHERE server_id = ? AND user_id = ?",
      )
      .run(serverId, userId);
  }

  deleteForServer(serverId: string): void {
    this.requireDatabase()
      .prepare("DELETE FROM paldefender_user_credentials WHERE server_id = ?")
      .run(serverId);
  }

  listForServer(serverId: string): StoredPalDefenderCredential[] {
    const rows = this.requireDatabase()
      .prepare(
        "SELECT * FROM paldefender_user_credentials WHERE server_id = ?",
      )
      .all(serverId) as unknown as CredentialRow[];
    return rows.map((row) => this.credential(row));
  }

  restore(credential: StoredPalDefenderCredential): void {
    this.requireDatabase()
      .prepare(
        `INSERT INTO paldefender_user_credentials (
          id, server_id, user_id, token, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT (server_id, user_id) DO UPDATE SET
          id = excluded.id,
          token = excluded.token,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at`,
      )
      .run(
        credential.id,
        credential.serverId,
        credential.userId,
        credential.token,
        credential.createdAt,
        credential.updatedAt,
      );
  }

  close(): void {
    this.database?.close();
    this.database = null;
  }

  reopen(): void {
    if (this.database) return;
    this.open();
  }

  private credential(row: CredentialRow): StoredPalDefenderCredential {
    return {
      id: row.id,
      serverId: row.server_id,
      userId: row.user_id,
      token: row.token,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private open(): void {
    this.database = new DatabaseSync(this.databasePath);
    this.database.exec("PRAGMA foreign_keys = ON;");
    tightenFilePermissionsSync(this.databasePath, this.onPermissionWarning);
  }

  private requireDatabase(): DatabaseSync {
    if (!this.database) throw new Error("users.sqlite is closed.");
    return this.database;
  }
}
