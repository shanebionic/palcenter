import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { UserRepository } from "../repositories/user-repository.js";
import type { PublicUser, StoredUser } from "../types/users.js";
import { PasswordService } from "./password-service.js";

interface SessionPayload {
  userId: string;
  sessionVersion: number;
  issuedAt: number;
  expiresAt: number;
}

interface AuthenticationServiceOptions {
  sessionSecret: string;
  sessionDurationSeconds: number;
  secureCookie: boolean;
}

interface LoginAttempt {
  count: number;
  firstAttemptAt: number;
}

export interface AuthenticatedSession {
  user: PublicUser;
  expiresAt: number;
}

export interface LoginResult {
  token: string;
  user: PublicUser;
}

export const sessionCookieName = "palcenter_session";

export class AuthenticationService {
  private signingKey: Buffer;
  private readonly loginAttempts = new Map<string, LoginAttempt>();

  constructor(
    private readonly options: AuthenticationServiceOptions,
    private readonly users: UserRepository,
    private readonly passwords: PasswordService,
  ) {
    this.signingKey = this.deriveSigningKey(options.sessionSecret);
  }

  async login(
    username: string,
    password: string,
    remoteAddress: string,
  ): Promise<LoginResult | null> {
    if (this.isRateLimited(remoteAddress)) return null;
    const user = this.users.findByUsername(username);
    const passwordValid =
      user && user.enabled
        ? await this.passwords.verify(password, user.passwordHash)
        : await this.passwords.verify(
            password,
            "scrypt$32768$8$3$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
          );
    if (!user || !user.enabled || !passwordValid) {
      this.recordFailedAttempt(remoteAddress);
      return null;
    }

    this.loginAttempts.delete(remoteAddress);
    const loggedIn = this.users.recordLogin(user.id, new Date().toISOString());
    return {
      token: this.createSession(loggedIn),
      user: this.public(loggedIn),
    };
  }

  sessionFromCookie(
    cookieHeader: string | undefined,
  ): AuthenticatedSession | null {
    if (!cookieHeader) return null;
    const token = cookieHeader
      .split(";")
      .map((cookie) => cookie.trim().split("="))
      .find(([name]) => name === sessionCookieName)?.[1];
    return token ? this.verifySession(token) : null;
  }

  createSessionFor(userId: string): string {
    const user = this.users.get(userId);
    if (!user || !user.enabled) throw new Error("Cannot create user session.");
    return this.createSession(user);
  }

  replaceSessionSecret(sessionSecret: string): void {
    this.signingKey = this.deriveSigningKey(sessionSecret);
  }

  isRateLimited(remoteAddress: string): boolean {
    const attempt = this.loginAttempts.get(remoteAddress);
    if (!attempt) return false;
    if (Date.now() - attempt.firstAttemptAt > 15 * 60 * 1_000) {
      this.loginAttempts.delete(remoteAddress);
      return false;
    }
    return attempt.count >= 5;
  }

  sessionCookie(token: string): string {
    return [
      `${sessionCookieName}=${token}`,
      "HttpOnly",
      "Path=/",
      "SameSite=Strict",
      `Max-Age=${this.options.sessionDurationSeconds}`,
      ...(this.options.secureCookie ? ["Secure"] : []),
    ].join("; ");
  }

  clearSessionCookie(): string {
    return [
      `${sessionCookieName}=`,
      "HttpOnly",
      "Path=/",
      "SameSite=Strict",
      "Max-Age=0",
      ...(this.options.secureCookie ? ["Secure"] : []),
    ].join("; ");
  }

  private createSession(user: StoredUser): string {
    const now = Math.floor(Date.now() / 1_000);
    const payload: SessionPayload = {
      userId: user.id,
      sessionVersion: user.sessionVersion,
      issuedAt: now,
      expiresAt: now + this.options.sessionDurationSeconds,
    };
    const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
      "base64url",
    );
    return `${encoded}.${this.sign(encoded)}`;
  }

  private verifySession(token: string): AuthenticatedSession | null {
    const [encoded, signature, extra] = token.split(".");
    if (!encoded || !signature || extra) return null;
    if (!this.constantTimeEqual(signature, this.sign(encoded))) return null;

    try {
      const payload: unknown = JSON.parse(
        Buffer.from(encoded, "base64url").toString("utf8"),
      );
      if (
        typeof payload !== "object" ||
        payload === null ||
        !("userId" in payload) ||
        !("sessionVersion" in payload) ||
        !("issuedAt" in payload) ||
        !("expiresAt" in payload) ||
        typeof payload.userId !== "string" ||
        typeof payload.sessionVersion !== "number" ||
        typeof payload.issuedAt !== "number" ||
        typeof payload.expiresAt !== "number" ||
        payload.expiresAt <= Math.floor(Date.now() / 1_000)
      ) {
        return null;
      }
      const user = this.users.get(payload.userId);
      if (
        !user ||
        !user.enabled ||
        user.sessionVersion !== payload.sessionVersion
      ) {
        return null;
      }
      return { user: this.public(user), expiresAt: payload.expiresAt };
    } catch {
      return null;
    }
  }

  private sign(value: string): string {
    return createHmac("sha256", this.signingKey)
      .update(value)
      .digest("base64url");
  }

  private deriveSigningKey(sessionSecret: string): Buffer {
    return createHmac("sha256", sessionSecret)
      .update("palcenter-session-v2")
      .digest();
  }

  private constantTimeEqual(left: string, right: string): boolean {
    return timingSafeEqual(
      createHash("sha256").update(left).digest(),
      createHash("sha256").update(right).digest(),
    );
  }

  private recordFailedAttempt(remoteAddress: string): void {
    const existing = this.loginAttempts.get(remoteAddress);
    const now = Date.now();
    if (!existing || now - existing.firstAttemptAt > 15 * 60 * 1_000) {
      this.loginAttempts.set(remoteAddress, { count: 1, firstAttemptAt: now });
    } else {
      existing.count += 1;
    }
  }

  private public(user: StoredUser): PublicUser {
    const { passwordHash: _hash, sessionVersion: _version, ...safe } = user;
    return safe;
  }
}
