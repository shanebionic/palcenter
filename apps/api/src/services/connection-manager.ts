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
}

export interface UpdateConnectionInput {
  name: string;
  baseUrl: string;
  adminPassword?: string;
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
    };
  }
}
