import type {
  ConnectionTestResult,
  PalworldServerInfo,
  PalworldServerMetrics,
  PalworldServerSettings,
} from "../types/connections.js";

export class PalworldRestError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "PalworldRestError";
  }
}

export class PalworldRestClient {
  private readonly apiUrl: string;
  private readonly authorization: string;

  constructor(baseUrl: string, adminPassword: string) {
    this.apiUrl = `${baseUrl.replace(/\/+$/, "")}/v1/api`;
    this.authorization = `Basic ${Buffer.from(
      `admin:${adminPassword}`,
      "utf8",
    ).toString("base64")}`;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    const startedAt = performance.now();

    const [info, metrics] = await Promise.all([
      this.request<PalworldServerInfo>("/info"),
      this.request<PalworldServerMetrics>("/metrics"),
    ]);

    return {
      info,
      metrics,
      latencyMs: Math.round(performance.now() - startedAt),
    };
  }

  async getSettings(): Promise<PalworldServerSettings> {
    return this.request<PalworldServerSettings>("/settings");
  }

  async announce(message: string): Promise<void> {
    await this.request<void>("/announce", {
      method: "POST",
      body: JSON.stringify({ message }),
    });
  }

  async saveWorld(): Promise<void> {
    await this.request<void>("/save", {
      method: "POST",
    });
  }

  async shutdown(waitTime: number, message?: string): Promise<void> {
    await this.request<void>("/shutdown", {
      method: "POST",
      body: JSON.stringify({
        waittime: waitTime,
        ...(message ? { message } : {}),
      }),
    });
  }

  async stop(): Promise<void> {
    await this.request<void>("/stop", {
      method: "POST",
    });
  }

  private async request<T>(
    endpoint: string,
    init: RequestInit = {},
  ): Promise<T> {
    let response: Response;

    try {
      response = await fetch(`${this.apiUrl}${endpoint}`, {
        ...init,
        headers: {
          Accept: "application/json",
          Authorization: this.authorization,
          ...(init.body ? { "Content-Type": "application/json" } : {}),
          ...init.headers,
        },
        signal: AbortSignal.timeout(8_000),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown connection error";

      throw new PalworldRestError(
        `Unable to reach the Palworld REST API: ${message}`,
      );
    }

    if (response.status === 401) {
      throw new PalworldRestError(
        "The Palworld server rejected the admin password.",
        401,
      );
    }

    if (!response.ok) {
      throw new PalworldRestError(
        `Palworld REST request failed with HTTP ${response.status}.`,
        response.status,
      );
    }

    const text = await response.text();

    if (!text) {
      return undefined as T;
    }

    return JSON.parse(text) as T;
  }
}
