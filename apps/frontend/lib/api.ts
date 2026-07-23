import type {
  ConnectedPlayer,
  PublicConnection,
  ServerStatus,
  ServerWorkspaceData,
} from "../types/servers";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ??
  "http://localhost:3001";

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
  let response: Response;

  try {
    response = await fetch(`${apiUrl}${path}`, init);
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Unable to reach the PalCenter API: ${error.message}`
        : "Unable to reach the PalCenter API.",
    );
  }

  if (!response.ok) {
    const error: unknown = await response.json().catch(() => null);

    throw new Error(
      errorMessage(error) ?? `Request failed with HTTP ${response.status}.`,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function jsonRequest<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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
