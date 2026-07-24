import type {
  ConnectedPlayer,
  NotificationConfiguration,
  NotificationConfigurationInput,
  NotificationConfigurationUpdate,
  PublicConnection,
  ServerStatus,
  ServerEvent,
  ServerMetric,
  ServerSettings,
  ServerWorkspaceData,
} from "../types/servers";

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

interface HistoryResponse {
  metrics: ServerMetric[];
}

interface EventsResponse {
  events: ServerEvent[];
}

interface NotificationsResponse {
  providers: NotificationConfiguration[];
}

export interface AuthSession {
  authenticated: boolean;
  username: string;
  version: string;
}

export interface ServerConnectionInput {
  name: string;
  baseUrl: string;
  adminPassword: string;
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
