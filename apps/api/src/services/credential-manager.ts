import { randomUUID } from "node:crypto";
import type { CredentialRepository } from "../repositories/credential-repository.js";
import type { UserRepository } from "../repositories/user-repository.js";
import type {
  PalDefenderCredentialResult,
  PublicPalDefenderCredentialAssignment,
} from "../types/credentials.js";
import { UserNotFoundError } from "./user-service.js";
import { CredentialUserNotFoundError } from "../repositories/sqlite-credential-repository.js";

const MAX_TOKEN_LENGTH = 2_048;

export class CredentialTokenError extends Error {}

export class CredentialManager {
  constructor(
    private readonly credentials: CredentialRepository,
    private readonly users: UserRepository,
  ) {}

  assign(
    serverId: string,
    userId: string,
    token: string,
  ): PalDefenderCredentialResult {
    const user = this.requireUser(userId);
    const trimmed = token.trim();
    if (trimmed.length === 0) {
      throw new CredentialTokenError("A PalDefender bearer token is required.");
    }
    if (trimmed.length > MAX_TOKEN_LENGTH) {
      throw new CredentialTokenError(
        `The PalDefender bearer token is too long (maximum ${MAX_TOKEN_LENGTH} characters).`,
      );
    }
    const now = new Date().toISOString();
    const existing = this.credentials.getForUser(serverId, userId);
    let saved;
    try {
      saved = this.credentials.upsert(
        serverId,
        userId,
        trimmed,
        existing?.id ?? `crd_${randomUUID()}`,
        now,
      );
    } catch (error) {
      if (error instanceof CredentialUserNotFoundError) {
        throw new UserNotFoundError("The requested user does not exist.");
      }
      throw error;
    }
    return {
      userId,
      username: user.username,
      configured: true,
      updatedAt: saved.updatedAt,
    };
  }

  revoke(serverId: string, userId: string): void {
    this.requireUser(userId);
    this.credentials.removeForUser(serverId, userId);
  }

  listForServer(serverId: string): PublicPalDefenderCredentialAssignment[] {
    return this.users.list().map((user) => {
      const assigned = this.credentials.getForUser(serverId, user.id);
      return {
        userId: user.id,
        username: user.username,
        role: user.role,
        configured: assigned !== null,
        updatedAt: assigned?.updatedAt ?? null,
      };
    });
  }

  private requireUser(userId: string) {
    const user = this.users.get(userId);
    if (!user)
      throw new UserNotFoundError("The requested user does not exist.");
    return user;
  }
}
