import { z } from "zod";
import type { ConnectionRepository } from "../repositories/connection-repository.js";
import type {
  CompanionConnectionState,
  CompanionPlayerActivity,
  CompanionPlayerLocation,
  CompanionAdminActionResponse,
  CompanionStatus,
} from "../types/companion.js";

const healthSchema = z.object({ status: z.literal("healthy") }).passthrough();
const runtimeSchema = z
  .object({
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
    runtime: runtimeSchema.nullable().optional(),
  })
  .passthrough();
const capabilitySchema = z
  .object({ supported: z.boolean(), capabilityVersion: z.string() })
  .passthrough();
const capabilitiesSchema = z
  .object({ categories: z.record(z.string(), z.unknown()) })
  .passthrough();
const adminActionsSchema = z.object({
  actions: z.record(z.string(), z.boolean()),
}).passthrough();
const adminActionResponseSchema = z.object({
  requestId: z.string(), action: z.string(), status: z.enum(["succeeded", "rejected"]),
  error: z.string().nullable(), message: z.string(),
}).passthrough();
const activityRecordSchema = z
  .object({
    eventId: z.string().min(1).max(200),
    eventType: z.enum([
      "player_joined",
      "player_left",
      "session_started",
      "session_ended",
    ]),
    timestamp: z.string().datetime({ offset: true }),
    serverInstanceId: z.string().min(1).max(200),
    player: z.object({
      userId: z.string().max(200).nullable(),
      playerId: z.string().max(200).nullable(),
      name: z.string().max(200),
    }),
    sessionId: z.string().min(1).max(200),
    source: z.literal("palworld_server_hook"),
    schemaVersion: z.literal("1"),
    durationSeconds: z.number().int().nonnegative().nullable(),
    metadata: z.record(z.string(), z.unknown()),
  })
  .passthrough();
const activityResponseSchema = z
  .object({ activity: z.array(activityRecordSchema).max(200) })
  .passthrough();
const locationSchema = z.object({
  player: z.object({
    userId: z.string().max(200).nullable(),
    playerId: z.string().max(200).nullable(),
    name: z.string().max(200),
  }),
  position: z.object({ x: z.number(), y: z.number(), z: z.number() }),
  coordinateSpaceId: z.enum(["palpagos", "special_area"]),
  stageInstanceId: z.string().max(64).nullable(),
  capturedAt: z.string().datetime({ offset: true }),
  source: z.literal("palworld_server_state"),
});
const locationsResponseSchema = z.object({
  locations: z.array(locationSchema).max(200),
});

class CompanionAuthenticationError extends Error {}
class CompanionResponseError extends Error {}

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
    if (!connection || connection.companionEnabled === false)
      return this.result("disabled");
    const checkedAt = new Date().toISOString();
    try {
      const origin = this.origin(
        connection.baseUrl,
        connection.companionHost,
        connection.companionPort ?? 8213,
      );
      healthSchema.parse(await this.read(origin, "health"));
      if (!connection.companionApiToken)
        return this.store(
          serverId,
          this.result("authentication_required", checkedAt, "healthy"),
        );
      const headers = {
        Authorization: `Bearer ${connection.companionApiToken}`,
      };
      const version = versionSchema.parse(
        await this.read(origin, "version", headers),
      );
      if (version.apiVersion !== "v1")
        return this.store(
          serverId,
          this.result("incompatible_contract", checkedAt, "healthy"),
        );
      const rawCapabilities = await this.read(origin, "capabilities", headers);
      const modern = capabilitiesSchema.safeParse(rawCapabilities);
      const categories = modern.success
        ? Object.fromEntries(
            Object.entries(modern.data.categories).flatMap(([name, value]) => {
              const capability = capabilitySchema.safeParse(value);
              return capability.success ? [[name, capability.data]] : [];
            }),
          )
        : Object.fromEntries(
            Object.entries(
              z.record(z.string(), z.boolean()).parse(rawCapabilities),
            ).map(([name, supported]) => [
              name,
              { supported, capabilityVersion: "legacy" },
            ]),
          );
      return this.store(serverId, {
        state: "connected",
        checkedAt,
        health: "healthy",
        version: {
          ...version,
          buildCommit: version.buildCommit ?? null,
          buildBranch: version.buildBranch ?? null,
          buildDate: version.buildDate ?? null,
          compiler: version.compiler ?? null,
          palworldVersion: version.palworldVersion ?? null,
          ue4ssVersion: version.ue4ssVersion ?? null,
          compatibility: version.compatibility ?? {},
          runtime: version.runtime
            ? {
                ...version.runtime,
                instanceId: version.runtime.instanceId ?? null,
                checks: version.runtime.checks ?? {},
              }
            : null,
        },
        capabilities: categories,
        adminActions: modern.success && adminActionsSchema.safeParse(modern.data.categories.adminActions).success
          ? adminActionsSchema.parse(modern.data.categories.adminActions).actions
          : undefined,
      });
    } catch (error) {
      const state: CompanionConnectionState =
        error instanceof CompanionAuthenticationError
          ? "authentication_failed"
          : error instanceof CompanionResponseError ||
              error instanceof SyntaxError ||
              error instanceof z.ZodError
            ? "malformed_response"
            : "unreachable";
      return this.store(serverId, this.result(state, checkedAt));
    }
  }

  async activity(
    serverId: string,
    options: { after?: string; player?: string; limit?: number } = {},
  ): Promise<CompanionPlayerActivity[]> {
    const status = await this.discover(serverId);
    if (
      status.state !== "connected" ||
      status.capabilities.playerActivity?.supported !== true
    )
      return [];
    const connection = await this.connections.get(serverId);
    if (!connection?.companionApiToken) return [];
    const origin = this.origin(
      connection.baseUrl,
      connection.companionHost,
      connection.companionPort ?? 8213,
    );
    const search = new URLSearchParams({
      limit: String(Math.min(Math.max(options.limit ?? 200, 1), 200)),
    });
    if (options.after) search.set("after", options.after);
    if (options.player) search.set("player", options.player);
    try {
      return activityResponseSchema.parse(
        await this.read(origin, `activity?${search}`, {
          Authorization: `Bearer ${connection.companionApiToken}`,
        }),
      ).activity;
    } catch {
      return [];
    }
  }

  async locations(serverId: string): Promise<CompanionPlayerLocation[] | null> {
    const status = await this.discover(serverId);
    if (
      status.state !== "connected" ||
      status.capabilities.playerLocations?.supported !== true ||
      status.capabilities.coordinateSpaces?.supported !== true
    )
      return null;
    const connection = await this.connections.get(serverId);
    if (!connection?.companionApiToken) return null;
    try {
      const origin = this.origin(
        connection.baseUrl,
        connection.companionHost,
        connection.companionPort ?? 8213,
      );
      return locationsResponseSchema.parse(
        await this.read(origin, "locations", {
          Authorization: `Bearer ${connection.companionApiToken}`,
        }),
      ).locations;
    } catch {
      return null;
    }
  }

  async adminAction(
    serverId: string,
    action: "teleportAdminToPlayer" | "teleportPlayerToAdmin" | "teleportPlayerToLocation",
    payload: Record<string, unknown>,
  ): Promise<CompanionAdminActionResponse> {
    const status = await this.discover(serverId, true);
    if (status.state !== "connected") throw new Error("PalCenter Companion is unavailable.");
    if (status.adminActions?.[action] !== true)
      throw new Error("This Companion does not currently allow that teleport action.");
    const connection = await this.connections.get(serverId);
    if (!connection?.companionApiToken) throw new Error("Companion authentication is not configured.");
    const paths = {
      teleportAdminToPlayer: "admin-actions/teleport-admin-to-player",
      teleportPlayerToAdmin: "admin-actions/teleport-player-to-admin",
      teleportPlayerToLocation: "admin-actions/teleport-player-to-location",
    } as const;
    const response = await this.write(
      this.origin(connection.baseUrl, connection.companionHost, connection.companionPort ?? 8213),
      paths[action], payload, { Authorization: `Bearer ${connection.companionApiToken}` },
    );
    return adminActionResponseSchema.parse(response);
  }

  private origin(
    baseUrl: string,
    host: string | null | undefined,
    port: number,
  ): URL {
    const rest = new URL(baseUrl);
    const origin = host?.includes("://") ? new URL(host) : new URL(rest.origin);
    if (host && !host.includes("://")) origin.hostname = host;
    origin.port = String(port);
    origin.pathname = "/palcenter/v1/";
    origin.search = "";
    origin.hash = "";
    return origin;
  }

  private async read(
    origin: URL,
    path: string,
    headers: Record<string, string> = {},
  ): Promise<unknown> {
    const response = await this.fetcher(new URL(path, origin), {
      headers: { accept: "application/json", ...headers },
      redirect: "manual",
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (response.status === 401) throw new CompanionAuthenticationError();
    if (!response.ok || response.type === "opaqueredirect")
      throw new Error("Companion unavailable");
    if (
      !(response.headers.get("content-type") ?? "")
        .toLowerCase()
        .includes("application/json")
    )
      throw new CompanionResponseError();
    const text = await response.text();
    if (text.length > 65_536) throw new CompanionResponseError();
    return JSON.parse(text) as unknown;
  }
  private async write(origin: URL, path: string, body: Record<string, unknown>, headers: Record<string, string>): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetcher(new URL(path, origin), {
        method: "POST", headers: { accept: "application/json", "content-type": "application/json", ...headers },
        body: JSON.stringify(body), redirect: "manual", signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      throw new Error("The teleport result is uncertain. Verify the player's location before trying again.");
    }
    if (response.status === 401 || response.status === 403) throw new Error("The Companion denied this teleport request.");
    const text = await response.text();
    if (!response.ok) {
      try { const value = JSON.parse(text) as { message?: string }; throw new Error(value.message ?? "The Companion rejected this teleport request."); }
      catch (error) { if (error instanceof Error) throw error; throw new Error("The Companion rejected this teleport request."); }
    }
    return JSON.parse(text) as unknown;
  }

  private result(
    state: CompanionConnectionState,
    checkedAt = new Date().toISOString(),
    health: "healthy" | null = null,
  ): CompanionStatus {
    return { state, checkedAt, health, version: null, capabilities: {} };
  }
  private store(serverId: string, value: CompanionStatus): CompanionStatus {
    this.cache.set(serverId, { expiresAt: Date.now() + this.cacheMs, value });
    return value;
  }
}
