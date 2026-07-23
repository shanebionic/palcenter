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

export class ConnectionManager {
  constructor(
    private readonly repository: ConnectionRepository,
  ) {}

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

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  private sanitize(connection: StoredConnection): PublicConnection {
    return {
      id: connection.id,
      name: connection.name,
      baseUrl: connection.baseUrl,
      createdAt: connection.createdAt,
      updatedAt: connection.updatedAt,
    };
  }
}
