import type { UserRole } from "../types/users.js";

export type Permission =
  | "read"
  | "operate"
  | "manage_servers"
  | "manage_notifications"
  | "manage_backups"
  | "manage_users";

const permissions: Record<UserRole, ReadonlySet<Permission>> = {
  administrator: new Set([
    "read",
    "operate",
    "manage_servers",
    "manage_notifications",
    "manage_backups",
    "manage_users",
  ]),
  moderator: new Set(["read", "operate"]),
  visitor: new Set(["read"]),
};

export class AuthorizationService {
  can(role: UserRole, permission: Permission): boolean {
    return permissions[role].has(permission);
  }

  permissionFor(method: string, path: string): Permission {
    if (path.startsWith("/api/users")) return "manage_users";
    if (path.startsWith("/api/backup")) return "manage_backups";
    if (path.startsWith("/api/notifications")) return "manage_notifications";
    if (
      method === "GET" &&
      /^\/api\/servers\/[^/]+\/players$/.test(path)
    ) {
      return "operate";
    }
    if (
      method === "POST" &&
      (/^\/api\/servers\/[^/]+\/admin\//.test(path) ||
        /^\/api\/servers\/[^/]+\/players\/[^/]+\//.test(path))
    ) {
      return "operate";
    }
    if (
      (method === "POST" &&
        (path === "/api/servers" || path === "/api/servers/test")) ||
      (method === "DELETE" && /^\/api\/servers\/[^/]+$/.test(path))
    ) {
      return "manage_servers";
    }
    return method === "GET" || method === "HEAD" ? "read" : "manage_users";
  }
}
