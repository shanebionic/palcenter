import type { UserRole } from "./users.js";

export type PalDefenderCredentialSource = "user" | "server_default";

export interface StoredPalDefenderCredential {
  id: string;
  serverId: string;
  userId: string;
  token: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicPalDefenderCredentialAssignment {
  userId: string;
  username: string;
  role: UserRole;
  configured: boolean;
  updatedAt: string | null;
}

export interface PalDefenderCredentialResult {
  userId: string;
  username: string;
  configured: true;
  updatedAt: string;
}

declare module "fastify" {
  interface FastifyRequest {
    palDefenderCredentialSource?: PalDefenderCredentialSource;
  }
}
