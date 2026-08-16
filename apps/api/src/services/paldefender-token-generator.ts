import { randomBytes } from "node:crypto";
import type { UserRole } from "../types/users.js";
import { permissionsForRole } from "./paldefender-permissions.js";

// Generates the local PalDefender token-file artifact. PalDefender has no
// REST endpoint for token management, so administrators install the
// generated file in the PalDefender server's RESTAPI/Tokens folder. The
// artifact is a one-time secret: the token is returned exactly once and,
// when stored, only through the write-only credential manager.

export interface PalDefenderTokenArtifact {
  name: string;
  token: string;
  permissions: readonly string[];
  fileName: string;
  fileContent: string;
}

export class PalDefenderTokenGenerationError extends Error {}

const SAFE_FILENAME_CHARACTERS = /^[\w.-]+$/;
const USER_ID_PATTERN =
  /^usr_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
const NAME_USERNAME_MAX = 40;

export function tokenFileName(userId: string): string {
  if (!SAFE_FILENAME_CHARACTERS.test(userId)) {
    throw new PalDefenderTokenGenerationError("Unsupported user id format.");
  }
  return `PalCenter-${userId}.json`;
}

export function tokenName(userId: string, username: string): string {
  const match = USER_ID_PATTERN.exec(userId);
  if (!match) {
    throw new PalDefenderTokenGenerationError("Unsupported user id format.");
  }
  const stableSuffix = match[1].replace(/-/g, "").slice(0, 8).toUpperCase();
  const safeUsername = username
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, NAME_USERNAME_MAX);
  return `PalCenter-${safeUsername}-${stableSuffix}`;
}

export function generatePalDefenderToken(
  userId: string,
  username: string,
  role: UserRole,
): PalDefenderTokenArtifact {
  const permissions = [...permissionsForRole(role)].sort();
  const artifact: PalDefenderTokenArtifact = {
    name: tokenName(userId, username),
    token: randomBytes(32).toString("hex"),
    permissions,
    fileName: tokenFileName(userId),
    fileContent: "",
  };
  artifact.fileContent =
    JSON.stringify(
      {
        Name: artifact.name,
        Token: artifact.token,
        Permissions: artifact.permissions,
      },
      null,
      2,
    ) + "\n";
  return artifact;
}
