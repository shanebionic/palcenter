import type {
  ConnectedPlayer,
  NotificationConfiguration,
  NotificationConfigurationInput,
  NotificationConfigurationUpdate,
  LatestPlayerTelemetry,
  PlayerPositionSnapshot,
  PlayerTrailHistory,
  PublicConnection,
  ServerStatus,
  ServerEvent,
  ServerMetric,
  ServerSettings,
  ServerWorkspaceData,
  UserProfile,
  UserRole,
  WorldEvent,
  WorldEventQuery,
} from "../types/servers";
import { buildWorldEventQuery } from "./world-events";
import type {
  AutomationExecution,
  AutomationExecutionDetail,
  AutomationListQuery,
  AutomationSummary,
  AutomationTask,
  AutomationTaskInput,
} from "../types/automation";
import type { CompanionStatus } from "../types/companion";

const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ?? "";

interface ServersResponse<T> {
  servers: T[];
}

interface AdminActionResponse {
  success: boolean;
  message: string;
}

interface PlayersResponse {
  players: ConnectedPlayer[];
}

export interface PalDefenderStatus {
  connected: boolean;
  version: string;
  responseTime: number;
}

export interface PalDefenderPlayer {
  name: string;
  playerId: string;
  online: boolean;
  guild: string | null;
  level: number | null;
}

export interface PalDefenderPlayerDetails extends PalDefenderPlayer {
  worldLocation: { x?: number; y?: number; z?: number } | null;
  mapLocation: { x?: number; y?: number; z?: number } | null;
}

export interface PalDefenderInventoryItem {
  container: string;
  slot: number;
  itemId: string;
  quantity: number;
}

export interface PalDefenderPal {
  instanceId: string;
  location: "Team" | "Palbox" | "Base Camp";
  baseCampId: string | null;
  palId: string;
  nickname: string | null;
  gender: string | null;
  level: number | null;
  experience: number | null;
  shiny: boolean | null;
  rank: number | null;
  condensedPals: number | null;
  physicalHealth: string | null;
  workerSick: string | null;
  imported: boolean | null;
  hp: number | null;
  hunger: number | null;
  maxHunger: number | null;
  sanity: number | null;
  support: number | null;
  craftSpeed: number | null;
  palSouls: Record<string, number>;
  ivs: Record<string, number>;
  extraWorkSuitabilities: Record<string, number>;
  disabledWorkPreferences: string[];
  passiveSkills: string[];
  activeSkills: string[];
  learnedSkills: string[];
}

export interface PalDefenderKickResult {
  success: boolean;
  playerId: string;
}
export interface PalDefenderBanOptions {
  reason?: string;
  ipBan?: boolean;
}
export interface PalDefenderBanResult {
  success: boolean;
  playerId: string;
  ipBanned: boolean;
  bannedIp: string | null;
  kickedPlayers: number;
}
export interface PalDefenderBroadcastResult {
  success: boolean;
}
export interface PalDefenderGuildCamp {
  id: string;
  worldPosition: { x: number; y: number; z: number };
  mapPosition: { x: number; y: number; z: number };
}
export interface PalDefenderGuild {
  guildId: string;
  name: string | null;
  level: number;
  administrator: { playerId: string; name: string | null };
  baseCount: number;
  camps: PalDefenderGuildCamp[];
  memberCount: number;
  memberIds: string[];
}

interface HistoryResponse {
  metrics: ServerMetric[];
}

interface EventsResponse {
  events: ServerEvent[];
}

interface WorldEventsResponse {
  events: WorldEvent[];
}

interface NotificationsResponse {
  providers: NotificationConfiguration[];
}

export interface AuthSession {
  authenticated: boolean;
  user: UserProfile;
  version: string;
  application: {
    name: string;
    description: string;
    version: string;
    channel: "production" | "development";
    commit: string;
    deployment: string;
  };
}

export interface ServerConnectionInput {
  name: string;
  baseUrl: string;
  adminPassword: string;
  companionEnabled?: boolean;
  companionHost?: string | null;
  companionPort?: number;
  companionApiToken?: string;
  administratorPlayerId?: string | null;
}

export interface ServerConnectionUpdate {
  name: string;
  baseUrl: string;
  adminPassword?: string;
  companionEnabled?: boolean;
  companionHost?: string | null;
  companionPort?: number;
  companionApiToken?: string;
  administratorPlayerId?: string | null;
}

export interface ServerTestInput {
  baseUrl: string;
  adminPassword: string;
}

export interface ConnectionTestResult {
  info: {
    servername: string;
    version: string;
  };
  metrics: {
    currentplayernum: number;
    maxplayernum: number;
    serverfps: number;
  };
  latencyMs: number;
}

function errorMessage(value: unknown): string | undefined {
  if (
    typeof value === "object" &&
    value !== null &&
    "message" in value &&
    typeof value.message === "string"
  ) {
    return value.message;
  }

  return undefined;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await requestResponse(path, init);

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function requestResponse(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  let response: Response;

  try {
    response = await fetch(`${apiUrl}${path}`, {
      ...init,
      credentials: "include",
    });
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Unable to reach the PalCenter API: ${error.message}`
        : "Unable to reach the PalCenter API.",
    );
  }

  if (!response.ok) {
    const error: unknown = await response.json().catch(() => null);

    if (
      response.status === 401 &&
      typeof error === "object" &&
      error !== null &&
      "error" in error &&
      error.error === "authentication_required" &&
      typeof window !== "undefined"
    ) {
      const next = `${window.location.pathname}${window.location.search}`;
      window.location.assign(`/login?next=${encodeURIComponent(next)}`);
    }

    if (
      response.status === 409 &&
      typeof error === "object" &&
      error !== null &&
      "error" in error &&
      error.error === "setup_required" &&
      typeof window !== "undefined"
    ) {
      window.location.assign("/setup");
    }

    if (
      response.status === 403 &&
      typeof error === "object" &&
      error !== null &&
      "error" in error &&
      error.error === "password_change_required" &&
      typeof window !== "undefined"
    ) {
      window.location.assign("/profile");
    }

    throw new Error(
      errorMessage(error) ?? `Request failed with HTTP ${response.status}.`,
    );
  }

  return response;
}

function jsonRequest<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function login(
  username: string,
  password: string,
): Promise<AuthSession> {
  return jsonRequest<AuthSession>("/api/auth/login", {
    username,
    password,
  });
}

export function getSetupStatus(): Promise<{ setupRequired: boolean }> {
  return request<{ setupRequired: boolean }>("/api/auth/setup-status", {
    cache: "no-store",
  });
}

export function completeSetup(input: {
  username: string;
  email: string;
  password: string;
  passwordConfirmation: string;
}): Promise<AuthSession> {
  return jsonRequest<AuthSession>("/api/auth/setup", input);
}

export function getSession(): Promise<AuthSession> {
  return request<AuthSession>("/api/auth/session", {
    cache: "no-store",
  });
}

export function logout(): Promise<{ authenticated: false }> {
  return request<{ authenticated: false }>("/api/auth/logout", {
    method: "POST",
  });
}

export async function getServers(): Promise<PublicConnection[]> {
  const result = await request<ServersResponse<PublicConnection>>(
    "/api/servers",
    { cache: "no-store" },
  );

  return result.servers;
}

export async function getServerStatus(): Promise<ServerStatus[]> {
  const result = await request<ServersResponse<ServerStatus>>(
    "/api/servers/status",
    { cache: "no-store" },
  );

  return result.servers;
}

export function getServer(id: string): Promise<ServerWorkspaceData> {
  return request<ServerWorkspaceData>(
    `/api/servers/${encodeURIComponent(id)}`,
    { cache: "no-store" },
  );
}

export function getServerSettings(id: string): Promise<ServerSettings> {
  return request<ServerSettings>(
    `/api/servers/${encodeURIComponent(id)}/settings`,
    { cache: "no-store" },
  );
}

export function getCompanionStatus(id: string): Promise<CompanionStatus> {
  return request<CompanionStatus>(
    `/api/servers/${encodeURIComponent(id)}/companion`,
    { cache: "no-store" },
  );
}

export function refreshCompanionStatus(id: string): Promise<CompanionStatus> {
  return request<CompanionStatus>(
    `/api/servers/${encodeURIComponent(id)}/companion/refresh`,
    { method: "POST" },
  );
}

export interface TeleportActionResult {
  requestId: string;
  action: string;
  status: "succeeded" | "rejected";
  error: string | null;
  message: string;
  resolvedDestination: { x: number; y: number; z: number } | null;
}
export function teleportPlayer(
  serverId: string,
  action: "admin-to-player" | "player-to-admin" | "player-to-location",
  body: {
    requestId: string;
    targetPlayerId: string;
    coordinateSpace?: "palpagos";
    verification?: "palpagos_map";
    x?: number;
    y?: number;
  },
): Promise<TeleportActionResult> {
  return jsonRequest<TeleportActionResult>(
    `/api/servers/${encodeURIComponent(serverId)}/teleport/${action}`,
    body,
  );
}

export async function getServerHistory(id: string): Promise<ServerMetric[]> {
  const result = await request<HistoryResponse>(
    `/api/servers/${encodeURIComponent(id)}/history`,
    { cache: "no-store" },
  );

  return result.metrics;
}

export async function getServerEvents(id: string): Promise<ServerEvent[]> {
  const result = await request<EventsResponse>(
    `/api/servers/${encodeURIComponent(id)}/events`,
    { cache: "no-store" },
  );

  return result.events;
}

export async function getWorldEvents(
  serverId: string,
  query: WorldEventQuery,
  signal?: AbortSignal,
): Promise<WorldEvent[]> {
  const result = await request<WorldEventsResponse>(
    `/api/servers/${encodeURIComponent(serverId)}/world-events?${buildWorldEventQuery(query)}`,
    { cache: "no-store", signal },
  );
  return result.events;
}

export function addServer(
  input: ServerConnectionInput,
): Promise<PublicConnection> {
  return jsonRequest<PublicConnection>("/api/servers", input);
}

export function testServer(
  input: ServerTestInput,
): Promise<ConnectionTestResult> {
  return jsonRequest<ConnectionTestResult>("/api/servers/test", input);
}

export function testServerUpdate(
  id: string,
  input: ServerTestInput,
): Promise<ConnectionTestResult> {
  return jsonRequest<ConnectionTestResult>(
    `/api/servers/${encodeURIComponent(id)}/test`,
    input,
  );
}

export function updateServer(
  id: string,
  input: ServerConnectionUpdate,
): Promise<PublicConnection> {
  return request<PublicConnection>(`/api/servers/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function deleteServer(id: string): Promise<void> {
  return request<void>(`/api/servers/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function announce(
  serverId: string,
  message: string,
): Promise<AdminActionResponse> {
  return jsonRequest<AdminActionResponse>(
    `/api/servers/${encodeURIComponent(serverId)}/admin/announce`,
    { message },
  );
}

export function saveWorld(serverId: string): Promise<AdminActionResponse> {
  return request<AdminActionResponse>(
    `/api/servers/${encodeURIComponent(serverId)}/admin/save`,
    { method: "POST" },
  );
}

export function shutdown(
  serverId: string,
  waitTime: number,
  message?: string,
): Promise<AdminActionResponse> {
  return jsonRequest<AdminActionResponse>(
    `/api/servers/${encodeURIComponent(serverId)}/admin/shutdown`,
    {
      waitTime,
      ...(message ? { message } : {}),
    },
  );
}

export function stop(serverId: string): Promise<AdminActionResponse> {
  return request<AdminActionResponse>(
    `/api/servers/${encodeURIComponent(serverId)}/admin/stop`,
    { method: "POST" },
  );
}

export async function getPlayers(serverId: string): Promise<ConnectedPlayer[]> {
  const result = await request<PlayersResponse>(
    `/api/servers/${encodeURIComponent(serverId)}/players`,
    { cache: "no-store" },
  );

  return result.players;
}

export function getPalDefenderStatus(): Promise<PalDefenderStatus> {
  return request<PalDefenderStatus>("/api/paldefender/status", {
    cache: "no-store",
  });
}

export async function getPalDefenderPlayers(): Promise<PalDefenderPlayer[]> {
  const result = await request<{ players: PalDefenderPlayer[] }>(
    "/api/paldefender/players",
    { cache: "no-store" },
  );
  return result.players;
}

export async function getPalDefenderGuilds(): Promise<PalDefenderGuild[]> {
  const result = await request<{ guilds: PalDefenderGuild[] }>(
    "/api/paldefender/guilds",
    { cache: "no-store" },
  );
  return result.guilds;
}

function palDefenderPlayerPath(playerId: string): string {
  return `/api/paldefender/players/${encodeURIComponent(playerId)}`;
}

export function getPalDefenderPlayer(
  playerId: string,
): Promise<PalDefenderPlayerDetails> {
  return request<PalDefenderPlayerDetails>(palDefenderPlayerPath(playerId), {
    cache: "no-store",
  });
}

export async function getPalDefenderInventory(
  playerId: string,
): Promise<PalDefenderInventoryItem[]> {
  const result = await request<{ items: PalDefenderInventoryItem[] }>(
    `${palDefenderPlayerPath(playerId)}/inventory`,
    { cache: "no-store" },
  );
  return result.items;
}

export async function getPalDefenderPals(
  playerId: string,
): Promise<PalDefenderPal[]> {
  const result = await request<{ pals: PalDefenderPal[] }>(
    `${palDefenderPlayerPath(playerId)}/pals`,
    { cache: "no-store" },
  );
  return result.pals;
}

export async function getPalDefenderTechnology(
  playerId: string,
): Promise<string[]> {
  const result = await request<{ technologies: string[] }>(
    `${palDefenderPlayerPath(playerId)}/technology`,
    { cache: "no-store" },
  );
  return result.technologies;
}

export function kickPalDefenderPlayer(
  playerId: string,
  message?: string,
): Promise<PalDefenderKickResult> {
  return jsonRequest<PalDefenderKickResult>(
    `${palDefenderPlayerPath(playerId)}/kick`,
    { ...(message?.trim() ? { message: message.trim() } : {}) },
  );
}

export function banPalDefenderPlayer(
  playerId: string,
  options: PalDefenderBanOptions = {},
): Promise<PalDefenderBanResult> {
  return jsonRequest<PalDefenderBanResult>(
    `${palDefenderPlayerPath(playerId)}/ban`,
    {
      ...(options.reason?.trim() ? { reason: options.reason.trim() } : {}),
      ...(options.ipBan ? { ipBan: true } : {}),
    },
  );
}

export function broadcastPalDefenderMessage(
  message: string,
): Promise<PalDefenderBroadcastResult> {
  return jsonRequest<PalDefenderBroadcastResult>("/api/paldefender/broadcast", {
    message,
  });
}

export async function getLatestPlayerTelemetry(
  serverId: string,
): Promise<PlayerPositionSnapshot[]> {
  return (await getPlayerTelemetry(serverId)).players;
}

export function getPlayerTelemetry(
  serverId: string,
): Promise<LatestPlayerTelemetry> {
  return request<LatestPlayerTelemetry>(
    `/api/servers/${encodeURIComponent(serverId)}/telemetry/players/latest`,
    { cache: "no-store" },
  );
}

export function getPlayerTrailHistory(
  serverId: string,
  userId: string,
  start: string,
  end: string,
  signal?: AbortSignal,
): Promise<PlayerTrailHistory> {
  const query = new URLSearchParams({ start, end, limit: "5000" });
  return request<PlayerTrailHistory>(
    `/api/servers/${encodeURIComponent(serverId)}/telemetry/players/${encodeURIComponent(userId)}/history?${query}`,
    { cache: "no-store", signal },
  );
}

export function kickPlayer(
  serverId: string,
  playerId: string,
): Promise<AdminActionResponse> {
  return playerAction(serverId, playerId, "kick");
}

export function banPlayer(
  serverId: string,
  playerId: string,
): Promise<AdminActionResponse> {
  return playerAction(serverId, playerId, "ban");
}

export function unbanPlayer(
  serverId: string,
  playerId: string,
): Promise<AdminActionResponse> {
  return playerAction(serverId, playerId, "unban");
}

export async function getNotifications(): Promise<NotificationConfiguration[]> {
  const result = await request<NotificationsResponse>("/api/notifications", {
    cache: "no-store",
  });
  return result.providers;
}

export function createNotification(
  input: NotificationConfigurationInput,
): Promise<NotificationConfiguration> {
  return jsonRequest<NotificationConfiguration>("/api/notifications", input);
}

export function updateNotification(
  id: string,
  input: NotificationConfigurationUpdate,
): Promise<NotificationConfiguration> {
  return request<NotificationConfiguration>(
    `/api/notifications/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}

export function deleteNotification(id: string): Promise<void> {
  return request<void>(`/api/notifications/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function testNotification(id: string): Promise<AdminActionResponse> {
  return request<AdminActionResponse>(
    `/api/notifications/${encodeURIComponent(id)}/test`,
    { method: "POST" },
  );
}

export interface BackupDownload {
  blob: Blob;
  filename: string;
}

export interface RestoreResult {
  success: true;
  message: string;
  metadata: {
    formatVersion: number;
    palcenterVersion: string;
    createdAt: string;
  };
}

export function getBackupInfo(): Promise<
  import("../types/servers").BackupInfo
> {
  return request<import("../types/servers").BackupInfo>("/api/backup/info", {
    cache: "no-store",
  });
}

export async function createBackup(): Promise<BackupDownload> {
  const response = await requestResponse("/api/backup", { method: "POST" });
  const disposition = response.headers.get("content-disposition") ?? "";
  const filename =
    /filename="([^"]+)"/.exec(disposition)?.[1] ?? "palcenter-backup.tar.gz";

  return { blob: await response.blob(), filename };
}

export function restoreBackup(file: File): Promise<RestoreResult> {
  return request<RestoreResult>("/api/backup/restore", {
    method: "POST",
    headers: {
      "Content-Type": "application/gzip",
      "X-PalCenter-Confirm-Restore": "replace-current-data",
    },
    body: file,
  });
}

export function getCurrentUser(): Promise<UserProfile> {
  return request<UserProfile>("/api/users/me", { cache: "no-store" });
}

export function changePassword(input: {
  currentPassword: string;
  newPassword: string;
  passwordConfirmation: string;
}): Promise<AdminActionResponse> {
  return jsonRequest<AdminActionResponse>("/api/users/me/password", input);
}

export async function getUsers(): Promise<UserProfile[]> {
  const result = await request<{ users: UserProfile[] }>("/api/users", {
    cache: "no-store",
  });
  return result.users;
}

export function createUser(input: {
  username: string;
  email: string;
  password: string;
  role: UserRole;
}): Promise<UserProfile> {
  return jsonRequest<UserProfile>("/api/users", input);
}

export function updateUser(
  id: string,
  input: {
    username: string;
    email: string;
    role: UserRole;
    enabled: boolean;
  },
): Promise<UserProfile> {
  return request<UserProfile>(`/api/users/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function resetUserPassword(
  id: string,
  password: string,
): Promise<AdminActionResponse> {
  return jsonRequest<AdminActionResponse>(
    `/api/users/${encodeURIComponent(id)}/password`,
    { password },
  );
}

export function deleteUser(id: string): Promise<void> {
  return request<void>(`/api/users/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function getAutomationTasks(
  query: AutomationListQuery = {},
): Promise<AutomationTask[]> {
  const parameters = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") parameters.set(key, String(value));
  }
  const suffix = parameters.size > 0 ? `?${parameters.toString()}` : "";
  const result = await request<{ tasks: AutomationTask[] }>(
    `/api/automations${suffix}`,
    { cache: "no-store" },
  );
  return result.tasks;
}

export function getAutomationSummary(): Promise<AutomationSummary> {
  return request<AutomationSummary>("/api/automations/summary", {
    cache: "no-store",
  });
}

export function previewAutomationSchedule(
  schedule: AutomationTaskInput["schedule"],
  timeZone: string,
): Promise<{ nextRunAt: string | null }> {
  return jsonRequest<{ nextRunAt: string | null }>("/api/automations/preview", {
    schedule,
    timeZone,
  });
}

export function createAutomationTask(
  input: AutomationTaskInput,
): Promise<AutomationTask> {
  return jsonRequest<AutomationTask>("/api/automations", input);
}

export function updateAutomationTask(
  id: string,
  input: AutomationTaskInput,
): Promise<AutomationTask> {
  return request<AutomationTask>(`/api/automations/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function setAutomationTaskEnabled(
  id: string,
  enabled: boolean,
): Promise<AutomationTask> {
  return request<AutomationTask>(
    `/api/automations/${encodeURIComponent(id)}/enabled`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    },
  );
}

export function runAutomationTask(
  id: string,
): Promise<{ execution: AutomationExecution }> {
  return request<{ execution: AutomationExecution }>(
    `/api/automations/${encodeURIComponent(id)}/run`,
    { method: "POST" },
  );
}

export async function getAutomationTaskHistory(
  id: string,
  limit = 50,
): Promise<AutomationExecutionDetail[]> {
  const result = await request<{ executions: AutomationExecutionDetail[] }>(
    `/api/automations/${encodeURIComponent(id)}/history?limit=${limit}`,
    { cache: "no-store" },
  );
  return result.executions;
}

export function deleteAutomationTask(id: string): Promise<void> {
  return request<void>(`/api/automations/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

function playerAction(
  serverId: string,
  playerId: string,
  action: "kick" | "ban" | "unban",
): Promise<AdminActionResponse> {
  return request<AdminActionResponse>(
    `/api/servers/${encodeURIComponent(serverId)}/players/${encodeURIComponent(playerId)}/${action}`,
    { method: "POST" },
  );
}
