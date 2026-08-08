import { randomBytes } from "node:crypto";
import { PalworldRestClient } from "../clients/palworld-rest-client.js";
import type { ConnectionRepository } from "../repositories/connection-repository.js";
import type {
  ConnectionTestResult,
  PublicConnection,
  StoredConnection,
} from "../types/connections.js";

export interface AddConnectionInput {
  name: string;
  baseUrl: string;
  adminPassword: string;
  companionEnabled?: boolean;
  companionHost?: string | null;
  companionPort?: number;
  companionApiToken?: string;
  administratorPlayerId?: string | null;
  palDefenderEnabled?: boolean;
  palDefenderEndpoint?: string | null;
  palDefenderToken?: string;
}

export interface UpdateConnectionInput {
  name: string;
  baseUrl: string;
  adminPassword?: string;
  companionEnabled?: boolean;
  companionHost?: string | null;
  companionPort?: number;
  companionApiToken?: string;
  administratorPlayerId?: string | null;
  palDefenderEnabled?: boolean;
  palDefenderEndpoint?: string | null;
  palDefenderToken?: string;
  clearPalDefenderToken?: boolean;
}

export class ConnectionNotFoundError extends Error {
  constructor() {
    super("The requested server does not exist.");
  }
}

export class ConnectionManager {
  constructor(private readonly repository: ConnectionRepository) {}

  async initialize(): Promise<void> {
    await this.repository.initialize();
  }

  async list(): Promise<PublicConnection[]> {
    const connections = await this.repository.list();

    return connections.map((connection) => this.sanitize(connection));
  }

  async test(
    baseUrl: string,
    adminPassword: string,
  ): Promise<ConnectionTestResult> {
    const client = new PalworldRestClient(baseUrl, adminPassword);
    return client.testConnection();
  }

  async testUpdate(
    id: string,
    baseUrl: string,
    adminPassword?: string,
  ): Promise<ConnectionTestResult> {
    const connection = await this.requireConnection(id);
    return this.test(
      baseUrl,
      adminPassword === undefined || adminPassword === ""
        ? connection.adminPassword
        : adminPassword,
    );
  }

  async add(input: AddConnectionInput): Promise<PublicConnection> {
    await this.test(input.baseUrl, input.adminPassword);

    const timestamp = new Date().toISOString();

    const connection: StoredConnection = {
      id: `srv_${randomBytes(6).toString("hex")}`,
      name: input.name.trim(),
      baseUrl: input.baseUrl.replace(/\/+$/, ""),
      adminPassword: input.adminPassword,
      companionEnabled: input.companionEnabled ?? true,
      companionHost: input.companionHost?.trim() || null,
      companionPort: input.companionPort ?? 8213,
      companionApiToken: input.companionApiToken ?? "",
      administratorPlayerId: input.administratorPlayerId ?? null,
      palDefenderEnabled: input.palDefenderEnabled ?? false,
      palDefenderEndpoint: normalizeOptionalUrl(input.palDefenderEndpoint),
      palDefenderToken: input.palDefenderToken ?? "",
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await this.repository.create(connection);

    return this.sanitize(connection);
  }

  async update(
    id: string,
    input: UpdateConnectionInput,
  ): Promise<PublicConnection> {
    const existing = await this.requireConnection(id);
    const connection: StoredConnection = {
      ...existing,
      name: input.name.trim(),
      baseUrl: input.baseUrl.replace(/\/+$/, ""),
      adminPassword:
        input.adminPassword === undefined || input.adminPassword === ""
          ? existing.adminPassword
          : input.adminPassword,
      companionEnabled:
        input.companionEnabled ?? existing.companionEnabled ?? true,
      companionHost:
        input.companionHost === undefined
          ? existing.companionHost
          : input.companionHost?.trim() || null,
      companionPort: input.companionPort ?? existing.companionPort ?? 8213,
      companionApiToken:
        input.companionApiToken === undefined || input.companionApiToken === ""
          ? (existing.companionApiToken ?? "")
          : input.companionApiToken,
      administratorPlayerId:
        input.administratorPlayerId === undefined
          ? (existing.administratorPlayerId ?? null)
          : input.administratorPlayerId,
      palDefenderEnabled:
        input.palDefenderEnabled ?? existing.palDefenderEnabled ?? false,
      palDefenderEndpoint:
        input.palDefenderEndpoint === undefined
          ? (existing.palDefenderEndpoint ?? null)
          : normalizeOptionalUrl(input.palDefenderEndpoint),
      palDefenderToken: input.clearPalDefenderToken
        ? ""
        : input.palDefenderToken === undefined || input.palDefenderToken === ""
          ? (existing.palDefenderToken ?? "")
          : input.palDefenderToken,
      updatedAt: new Date().toISOString(),
    };
    await this.repository.update(connection);
    return this.sanitize(connection);
  }

  private async requireConnection(id: string): Promise<StoredConnection> {
    const connection = await this.repository.get(id);
    if (!connection) throw new ConnectionNotFoundError();
    return connection;
  }

  private sanitize(connection: StoredConnection): PublicConnection {
    const baseUrl = new URL(connection.baseUrl);
    baseUrl.username = "";
    baseUrl.password = "";
    baseUrl.search = "";
    baseUrl.hash = "";

    return {
      id: connection.id,
      name: connection.name,
      baseUrl: baseUrl.toString().replace(/\/$/, ""),
      createdAt: connection.createdAt,
      updatedAt: connection.updatedAt,
      companion: {
        enabled: connection.companionEnabled ?? true,
        host: connection.companionHost ?? null,
        port: connection.companionPort ?? 8213,
        tokenConfigured: (connection.companionApiToken?.length ?? 0) > 0,
        administratorPlayerId: connection.administratorPlayerId ?? null,
      },
      palDefender: {
        enabled: connection.palDefenderEnabled ?? false,
        endpoint: sanitizeOptionalUrl(connection.palDefenderEndpoint),
        tokenConfigured: (connection.palDefenderToken?.length ?? 0) > 0,
      },
    };
  }
}

function normalizeOptionalUrl(value: string | null | undefined): string | null {
  return value?.trim().replace(/\/+$/, "") || null;
}

function sanitizeOptionalUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const url = new URL(value);
  url.username = "";
  url.password = "";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}
