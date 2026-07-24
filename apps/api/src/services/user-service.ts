import { randomUUID } from "node:crypto";
import type { UserRepository } from "../repositories/user-repository.js";
import type { PublicUser, UserRole } from "../types/users.js";
import { PasswordService } from "./password-service.js";

export class UserNotFoundError extends Error {}
export class UserConflictError extends Error {}
export class UserSafetyError extends Error {}
export class InvalidCurrentPasswordError extends Error {}
export class SetupUnavailableError extends Error {}

export interface UserIdentityInput {
  username: string;
  email: string;
}

export class UserService {
  constructor(
    private readonly users: UserRepository,
    private readonly passwords: PasswordService,
  ) {}

  setupRequired(): boolean {
    return this.users.setupRequired();
  }

  async setup(
    input: UserIdentityInput & { password: string },
  ): Promise<PublicUser> {
    const now = new Date().toISOString();
    try {
      return this.public(
        this.users.createInitial({
          id: `usr_${randomUUID()}`,
          username: input.username,
          email: input.email,
          passwordHash: await this.passwords.hash(input.password),
          role: "administrator",
          enabled: true,
          mustChangePassword: false,
          createdAt: now,
          updatedAt: now,
        }),
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes("already")) {
        throw new SetupUnavailableError(error.message);
      }
      throw this.mapConflict(error);
    }
  }

  list(): PublicUser[] {
    return this.users.list().map((user) => this.public(user));
  }

  get(id: string): PublicUser {
    const user = this.users.get(id);
    if (!user)
      throw new UserNotFoundError("The requested user does not exist.");
    return this.public(user);
  }

  async create(
    input: UserIdentityInput & { password: string; role: UserRole },
  ): Promise<PublicUser> {
    const now = new Date().toISOString();
    try {
      return this.public(
        this.users.create({
          id: `usr_${randomUUID()}`,
          username: input.username,
          email: input.email,
          passwordHash: await this.passwords.hash(input.password),
          role: input.role,
          enabled: true,
          mustChangePassword: true,
          createdAt: now,
          updatedAt: now,
        }),
      );
    } catch (error) {
      throw this.mapConflict(error);
    }
  }

  update(
    id: string,
    input: UserIdentityInput & { role: UserRole; enabled: boolean },
  ): PublicUser {
    try {
      return this.public(
        this.users.update(id, {
          ...input,
          updatedAt: new Date().toISOString(),
        }),
      );
    } catch (error) {
      throw this.mapMutationError(error);
    }
  }

  delete(id: string): void {
    try {
      this.users.delete(id);
    } catch (error) {
      throw this.mapMutationError(error);
    }
  }

  async changePassword(
    id: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<PublicUser> {
    const user = this.users.get(id);
    if (!user)
      throw new UserNotFoundError("The requested user does not exist.");
    if (!(await this.passwords.verify(currentPassword, user.passwordHash))) {
      throw new InvalidCurrentPasswordError(
        "The current password is incorrect.",
      );
    }
    return this.public(
      this.users.updatePassword(
        id,
        await this.passwords.hash(newPassword),
        false,
        new Date().toISOString(),
      ),
    );
  }

  async resetPassword(id: string, password: string): Promise<PublicUser> {
    if (!this.users.get(id)) {
      throw new UserNotFoundError("The requested user does not exist.");
    }
    return this.public(
      this.users.updatePassword(
        id,
        await this.passwords.hash(password),
        true,
        new Date().toISOString(),
      ),
    );
  }

  private public(user: import("../types/users.js").StoredUser): PublicUser {
    const {
      passwordHash: _passwordHash,
      sessionVersion: _sessionVersion,
      ...safe
    } = user;
    return safe;
  }

  private mapConflict(error: unknown): Error {
    if (
      error instanceof Error &&
      (error.message.includes("UNIQUE") || error.message.includes("constraint"))
    ) {
      return new UserConflictError(
        "Username and email address must be unique.",
      );
    }
    return error instanceof Error ? error : new Error("User operation failed.");
  }

  private mapMutationError(error: unknown): Error {
    if (error instanceof Error && error.message.includes("last enabled")) {
      return new UserSafetyError(error.message);
    }
    if (error instanceof Error && error.message.includes("not found")) {
      return new UserNotFoundError("The requested user does not exist.");
    }
    return this.mapConflict(error);
  }
}
