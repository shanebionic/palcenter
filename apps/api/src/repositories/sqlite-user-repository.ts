import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  userRoles,
  type NewUser,
  type StoredUser,
  type UserRole,
  type UserUpdate,
} from "../types/users.js";
import type { UserRepository } from "./user-repository.js";

interface UserRow {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  role: string;
  enabled: number;
  must_change_password: number;
  session_version: number;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

const schemaVersion = 1;

export class SqliteUserRepository implements UserRepository {
  private database: DatabaseSync | null = null;
  private readonly databasePath: string;

  constructor(configDirectory: string) {
    const directory = path.resolve(configDirectory);
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    fs.chmodSync(directory, 0o700);
    this.databasePath = path.join(directory, "users.sqlite");
    this.open();
  }

  initialize(): void {
    const database = this.requireDatabase();
    database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = FULL;
      PRAGMA busy_timeout = 5000;
      PRAGMA foreign_keys = ON;
    `);
    const version = (
      database.prepare("PRAGMA user_version").get() as {
        user_version: number;
      }
    ).user_version;
    if (version > schemaVersion) {
      throw new Error(
        `users.sqlite uses schema version ${version}, but this PalCenter version supports up to ${schemaVersion}.`,
      );
    }

    database.exec("BEGIN IMMEDIATE");
    try {
      database.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT NOT NULL COLLATE NOCASE UNIQUE,
          email TEXT NOT NULL COLLATE NOCASE UNIQUE,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('administrator', 'moderator', 'visitor')),
          enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
          must_change_password INTEGER NOT NULL CHECK (must_change_password IN (0, 1)),
          session_version INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          last_login_at TEXT
        );
        CREATE TABLE IF NOT EXISTS authentication_metadata (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
        PRAGMA user_version = 1;
      `);
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
    this.validate();
  }

  setupRequired(): boolean {
    const completed = this.requireDatabase()
      .prepare(
        "SELECT value FROM authentication_metadata WHERE key = 'setup_completed'",
      )
      .get() as { value: string } | undefined;
    const count = this.requireDatabase()
      .prepare("SELECT COUNT(*) AS count FROM users")
      .get() as { count: number };
    return completed?.value !== "true" && count.count === 0;
  }

  createInitial(user: NewUser): StoredUser {
    const database = this.requireDatabase();
    database.exec("BEGIN IMMEDIATE");
    try {
      const count = database
        .prepare("SELECT COUNT(*) AS count FROM users")
        .get() as { count: number };
      const completed = database
        .prepare(
          "SELECT value FROM authentication_metadata WHERE key = 'setup_completed'",
        )
        .get() as { value: string } | undefined;
      if (count.count !== 0 || completed?.value === "true") {
        throw new Error("PalCenter setup has already been completed.");
      }
      const created = this.insert({ ...user, role: "administrator" });
      database
        .prepare(
          `INSERT INTO authentication_metadata (key, value)
           VALUES ('setup_completed', 'true')`,
        )
        .run();
      database.exec("COMMIT");
      return created;
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }

  list(): StoredUser[] {
    const rows = this.requireDatabase()
      .prepare("SELECT * FROM users ORDER BY username COLLATE NOCASE")
      .all() as unknown as UserRow[];
    return rows.map((row) => this.user(row));
  }

  get(id: string): StoredUser | null {
    const row = this.requireDatabase()
      .prepare("SELECT * FROM users WHERE id = ?")
      .get(id) as UserRow | undefined;
    return row ? this.user(row) : null;
  }

  findByUsername(username: string): StoredUser | null {
    const row = this.requireDatabase()
      .prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE")
      .get(username) as UserRow | undefined;
    return row ? this.user(row) : null;
  }

  create(user: NewUser): StoredUser {
    return this.insert(user);
  }

  update(id: string, update: UserUpdate): StoredUser {
    const database = this.requireDatabase();
    database.exec("BEGIN IMMEDIATE");
    try {
      const existing = this.required(id);
      if (
        existing.role === "administrator" &&
        existing.enabled &&
        (update.role !== "administrator" || !update.enabled) &&
        this.enabledAdministratorCount() <= 1
      ) {
        throw new Error("The last enabled Administrator cannot be changed.");
      }
      database
        .prepare(
          `UPDATE users SET username = ?, email = ?, role = ?, enabled = ?,
           updated_at = ?, session_version = session_version + 1 WHERE id = ?`,
        )
        .run(
          update.username,
          update.email,
          update.role,
          update.enabled ? 1 : 0,
          update.updatedAt,
          id,
        );
      const result = this.required(id);
      database.exec("COMMIT");
      return result;
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }

  updatePassword(
    id: string,
    passwordHash: string,
    mustChangePassword: boolean,
    updatedAt: string,
  ): StoredUser {
    const result = this.requireDatabase()
      .prepare(
        `UPDATE users SET password_hash = ?, must_change_password = ?,
         updated_at = ?, session_version = session_version + 1 WHERE id = ?`,
      )
      .run(passwordHash, mustChangePassword ? 1 : 0, updatedAt, id);
    if (result.changes !== 1) throw new Error("User not found.");
    return this.required(id);
  }

  recordLogin(id: string, loggedInAt: string): StoredUser {
    this.requireDatabase()
      .prepare("UPDATE users SET last_login_at = ? WHERE id = ?")
      .run(loggedInAt, id);
    return this.required(id);
  }

  delete(id: string): void {
    const database = this.requireDatabase();
    database.exec("BEGIN IMMEDIATE");
    try {
      const existing = this.required(id);
      if (
        existing.role === "administrator" &&
        existing.enabled &&
        this.enabledAdministratorCount() <= 1
      ) {
        throw new Error("The last enabled Administrator cannot be deleted.");
      }
      database.prepare("DELETE FROM users WHERE id = ?").run(id);
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }

  check(): void {
    this.validate();
  }

  close(): void {
    this.database?.close();
    this.database = null;
  }

  reopen(): void {
    if (this.database) return;
    this.open();
    try {
      this.initialize();
    } catch (error) {
      this.close();
      throw error;
    }
  }

  private insert(user: NewUser): StoredUser {
    this.requireDatabase()
      .prepare(
        `INSERT INTO users (
          id, username, email, password_hash, role, enabled,
          must_change_password, session_version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      )
      .run(
        user.id,
        user.username,
        user.email,
        user.passwordHash,
        user.role,
        user.enabled ? 1 : 0,
        user.mustChangePassword ? 1 : 0,
        user.createdAt,
        user.updatedAt,
      );
    return this.required(user.id);
  }

  private enabledAdministratorCount(): number {
    return (
      this.requireDatabase()
        .prepare(
          `SELECT COUNT(*) AS count FROM users
           WHERE role = 'administrator' AND enabled = 1`,
        )
        .get() as { count: number }
    ).count;
  }

  private required(id: string): StoredUser {
    const user = this.get(id);
    if (!user) throw new Error("User not found.");
    return user;
  }

  private validate(): void {
    const database = this.requireDatabase();
    const integrity = database.prepare("PRAGMA quick_check").get() as {
      quick_check: string;
    };
    if (integrity.quick_check !== "ok") {
      throw new Error(
        `users.sqlite failed its integrity check: ${integrity.quick_check}`,
      );
    }
    const invalidRole = database
      .prepare(
        `SELECT role FROM users
         WHERE role NOT IN ('administrator', 'moderator', 'visitor') LIMIT 1`,
      )
      .get() as { role: string } | undefined;
    if (invalidRole || userRoles.length !== 3) {
      throw new Error("users.sqlite contains an invalid user role.");
    }
  }

  private user(row: UserRow): StoredUser {
    if (!userRoles.includes(row.role as UserRole)) {
      throw new Error("users.sqlite contains an invalid user role.");
    }
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      passwordHash: row.password_hash,
      role: row.role as UserRole,
      enabled: row.enabled === 1,
      mustChangePassword: row.must_change_password === 1,
      sessionVersion: row.session_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastLoginAt: row.last_login_at,
    };
  }

  private open(): void {
    this.database = new DatabaseSync(this.databasePath);
    fs.chmodSync(this.databasePath, 0o600);
  }

  private requireDatabase(): DatabaseSync {
    if (!this.database) throw new Error("users.sqlite is closed.");
    return this.database;
  }
}
