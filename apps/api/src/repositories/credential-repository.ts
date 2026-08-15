import type { StoredPalDefenderCredential } from "../types/credentials.js";

export interface CredentialRepository {
  getForUser(
    serverId: string,
    userId: string,
  ): StoredPalDefenderCredential | null;
  upsert(
    serverId: string,
    userId: string,
    token: string,
    id: string,
    now: string,
  ): StoredPalDefenderCredential;
  removeForUser(serverId: string, userId: string): void;
  deleteForServer(serverId: string): void;
  close(): void;
  reopen(): void;
}
