import { createHash, createHmac, timingSafeEqual } from "node:crypto";

interface SessionPayload {
  username: string;
  expiresAt: number;
}

interface AuthenticationServiceOptions {
  username: string;
  password: string;
  sessionSecret: string;
  sessionDurationSeconds: number;
  secureCookie: boolean;
}

interface LoginAttempt {
  count: number;
  firstAttemptAt: number;
}

export const sessionCookieName = "palcenter_session";

export class AuthenticationService {
  private readonly signingKey: Buffer;
  private readonly loginAttempts = new Map<string, LoginAttempt>();

  constructor(private readonly options: AuthenticationServiceOptions) {
    this.signingKey = createHmac("sha256", options.sessionSecret)
      .update(options.password)
      .digest();
  }

  login(
    username: string,
    password: string,
    remoteAddress: string,
  ): string | null {
    if (this.isRateLimited(remoteAddress)) {
      return null;
    }

    const usernameValid = this.constantTimeEqual(
      username,
      this.options.username,
    );
    const passwordValid = this.constantTimeEqual(
      password,
      this.options.password,
    );
    const valid = usernameValid && passwordValid;

    if (!valid) {
      this.recordFailedAttempt(remoteAddress);
      return null;
    }

    this.loginAttempts.delete(remoteAddress);
    return this.createSession();
  }

  isRateLimited(remoteAddress: string): boolean {
    const attempt = this.loginAttempts.get(remoteAddress);

    if (!attempt) {
      return false;
    }

    if (Date.now() - attempt.firstAttemptAt > 15 * 60 * 1_000) {
      this.loginAttempts.delete(remoteAddress);
      return false;
    }

    return attempt.count >= 5;
  }

  sessionFromCookie(cookieHeader: string | undefined): SessionPayload | null {
    if (!cookieHeader) {
      return null;
    }

    const token = cookieHeader
      .split(";")
      .map((cookie) => cookie.trim().split("="))
      .find(([name]) => name === sessionCookieName)?.[1];

    return token ? this.verifySession(token) : null;
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

  private createSession(): string {
    const payload: SessionPayload = {
      username: this.options.username,
      expiresAt:
        Math.floor(Date.now() / 1_000) + this.options.sessionDurationSeconds,
    };
    const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
      "base64url",
    );
    const signature = this.sign(encoded);

    return `${encoded}.${signature}`;
  }

  private verifySession(token: string): SessionPayload | null {
    const [encoded, signature, extra] = token.split(".");

    if (!encoded || !signature || extra) {
      return null;
    }

    if (!this.constantTimeEqual(signature, this.sign(encoded))) {
      return null;
    }

    try {
      const payload: unknown = JSON.parse(
        Buffer.from(encoded, "base64url").toString("utf8"),
      );

      if (
        typeof payload !== "object" ||
        payload === null ||
        !("username" in payload) ||
        !("expiresAt" in payload) ||
        payload.username !== this.options.username ||
        typeof payload.expiresAt !== "number" ||
        payload.expiresAt <= Math.floor(Date.now() / 1_000)
      ) {
        return null;
      }

      return {
        username: payload.username,
        expiresAt: payload.expiresAt,
      };
    } catch {
      return null;
    }
  }

  private sign(value: string): string {
    return createHmac("sha256", this.signingKey)
      .update(value)
      .digest("base64url");
  }

  private constantTimeEqual(left: string, right: string): boolean {
    const leftDigest = createHash("sha256").update(left).digest();
    const rightDigest = createHash("sha256").update(right).digest();
    return timingSafeEqual(leftDigest, rightDigest);
  }

  private recordFailedAttempt(remoteAddress: string): void {
    const existing = this.loginAttempts.get(remoteAddress);
    const now = Date.now();

    if (!existing || now - existing.firstAttemptAt > 15 * 60 * 1_000) {
      this.loginAttempts.set(remoteAddress, {
        count: 1,
        firstAttemptAt: now,
      });
      return;
    }

    existing.count += 1;
  }
}
