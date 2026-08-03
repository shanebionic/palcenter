import { z } from "zod";
import type { ConnectionRepository } from "../repositories/connection-repository.js";
import type { CompanionStatus } from "../types/companion.js";

const healthSchema = z
  .object({
    status: z.string(),
    applicationVersion: z.string(),
    apiVersion: z.string(),
    startedAt: z.string(),
    uptimeSeconds: z.number().nonnegative(),
    instanceId: z.string().nullable().optional(),
    checks: z.record(z.string(), z.string()).optional(),
  })
  .passthrough();
const versionSchema = z
  .object({
    applicationVersion: z.string(),
    apiVersion: z.string(),
    buildCommit: z.string().nullable().optional(),
    buildBranch: z.string().nullable().optional(),
    buildDate: z.string().nullable().optional(),
    compiler: z.string().nullable().optional(),
    palworldVersion: z.string().nullable().optional(),
    ue4ssVersion: z.string().nullable().optional(),
    compatibility: z.record(z.string(), z.string()).optional(),
  })
  .passthrough();
const capabilitySchema = z
  .object({ supported: z.boolean(), capabilityVersion: z.string() })
  .passthrough();
const capabilitiesSchema = z
  .object({
    categories: z.record(z.string(), capabilitySchema),
  })
  .passthrough();

export class CompanionDiscoveryService {
  private readonly cache = new Map<
    string,
    { expiresAt: number; value: CompanionStatus }
  >();

  constructor(
    private readonly connections: ConnectionRepository,
    private readonly timeoutMs = 2_500,
    private readonly cacheMs = 30_000,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async discover(serverId: string, refresh = false): Promise<CompanionStatus> {
    const cached = this.cache.get(serverId);
    if (!refresh && cached && cached.expiresAt > Date.now())
      return cached.value;
    const connection = await this.connections.get(serverId);
    if (!connection) return this.unavailable("not_installed");
    const origin = new URL(connection.baseUrl);
    origin.port = "8213";
    origin.pathname = "/palcenter/v1/";
    origin.search = "";
    const checkedAt = new Date().toISOString();
    try {
      const [health, version, capabilities] = await this.readDocuments(origin);
      const value: CompanionStatus = {
        status: "connected",
        checkedAt,
        reason: null,
        health: {
          ...health,
          instanceId: health.instanceId ?? null,
          checks: health.checks ?? {},
        },
        version: {
          ...version,
          buildCommit: version.buildCommit ?? null,
          buildBranch: version.buildBranch ?? null,
          buildDate: version.buildDate ?? null,
          compiler: version.compiler ?? null,
          palworldVersion: version.palworldVersion ?? null,
          ue4ssVersion: version.ue4ssVersion ?? null,
          compatibility: version.compatibility ?? {},
        },
        capabilities: capabilities.categories,
      };
      this.cache.set(serverId, { expiresAt: Date.now() + this.cacheMs, value });
      return value;
    } catch (error) {
      const reason =
        error instanceof DOMException && error.name === "TimeoutError"
          ? "timeout"
          : error instanceof SyntaxError || error instanceof z.ZodError
            ? "invalid_response"
            : "not_installed";
      const value = this.unavailable(reason, checkedAt);
      this.cache.set(serverId, { expiresAt: Date.now() + this.cacheMs, value });
      return value;
    }
  }

  private async readDocuments(origin: URL) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(new DOMException("Timed out", "TimeoutError")),
      this.timeoutMs,
    );
    try {
      const read = async (path: string): Promise<unknown> => {
        const response = await this.fetcher(new URL(path, origin), {
          signal: controller.signal,
          headers: { accept: "application/json" },
        });
        if (!response.ok)
          throw new Error(`Companion returned HTTP ${response.status}`);
        return response.json() as Promise<unknown>;
      };
      const health = healthSchema.parse(await read("health"));
      const version = versionSchema.parse(await read("version"));
      const rawCapabilities = await read("capabilities");
      const modern = capabilitiesSchema.safeParse(rawCapabilities);
      if (modern.success) return [health, version, modern.data] as const;
      const legacy = z.record(z.string(), z.boolean()).parse(rawCapabilities);
      return [
        health,
        version,
        {
          categories: Object.fromEntries(
            Object.entries(legacy).map(([name, supported]) => [
              name,
              { supported, capabilityVersion: "legacy" },
            ]),
          ),
        },
      ] as const;
    } finally {
      clearTimeout(timeout);
    }
  }

  private unavailable(
    reason: CompanionStatus["reason"],
    checkedAt = new Date().toISOString(),
  ): CompanionStatus {
    return {
      status: "unavailable",
      checkedAt,
      reason,
      health: null,
      version: null,
      capabilities: {},
    };
  }
}
