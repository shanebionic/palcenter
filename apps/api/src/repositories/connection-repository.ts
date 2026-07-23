import type { StoredConnection } from "../types/connections.js";

export interface ConnectionRepository {
  initialize(): Promise<void>;
  list(): Promise<StoredConnection[]>;
  get(id: string): Promise<StoredConnection | null>;
  create(connection: StoredConnection): Promise<void>;
  delete(id: string): Promise<void>;
}
