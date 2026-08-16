import type { UserRole } from "../types/users.js";

export type Permission =
  | "read"
  | "operate"
  | "manage_servers"
  | "manage_notifications"
  | "manage_backups"
  | "manage_automations"
  | "manage_users";

const permissions: Record<UserRole, ReadonlySet<Permission>> = {
  administrator: new Set([
    "read",
    "operate",
    "manage_servers",
    "manage_notifications",
    "manage_backups",
    "manage_automations",
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
    if (path.startsWith("/api/automations")) {
      return method === "GET" || method === "HEAD"
        ? "read"
        : "manage_automations";
    }
    if (path.startsWith("/api/users")) return "manage_users";
    if (path.startsWith("/api/backup")) return "manage_backups";
    if (path.startsWith("/api/notifications")) return "manage_notifications";
    if (method === "GET" && /^\/api\/servers\/[^/]+\/players$/.test(path)) {
      return "operate";
    }
    if (
      method === "GET" &&
      (/^\/api\/servers\/[^/]+\/telemetry\/players\/[^/]+\/history$/.test(
        path,
      ) ||
        /^\/api\/servers\/[^/]+\/world-events$/.test(path))
    ) {
      return "operate";
    }
    // All PalDefender player operations are explicit `operate` actions
    // (moderators perform operational server/player access). These routes
    // were resolved to `operate` instead of relying on the generic
    // non-GET fallback, which would have mapped them to `manage_users`.
    if (
      method === "POST" &&
      (/^\/api\/servers\/[^/]+\/admin\//.test(path) ||
        /^\/api\/servers\/[^/]+\/players\/[^/]+\//.test(path) ||
        /^\/api\/servers\/[^/]+\/paldefender\/players\/[^/]+\/(kick|ban|items|pals|progression|pal-templates|pal-eggs|technology\/(learn|forget))$/.test(
          path,
        ) ||
        /^\/api\/servers\/[^/]+\/moderation\/(users\/[^/]+\/unban|ip\/(ban|unban))$/.test(
          path,
        ) ||
        /^\/api\/servers\/[^/]+\/paldefender\/(broadcast|alert|player-message)$/.test(
          path,
        ))
    ) {
      return "operate";
    }
    if (
      /^\/api\/servers\/[^/]+\/users\/paldefender-credentials$/.test(path) ||
      /^\/api\/servers\/[^/]+\/users\/[^/]+\/paldefender-credential($|\/generate)$/.test(
        path,
      )
    ) {
      return "manage_users";
    }
    if (
      (method === "POST" &&
        (path === "/api/servers" || path === "/api/servers/test")) ||
      (method === "POST" && /^\/api\/servers\/[^/]+\/test$/.test(path)) ||
      (method === "POST" &&
        /^\/api\/servers\/[^/]+\/paldefender\/reload-config$/.test(path)) ||
      (method === "POST" &&
        /^\/api\/servers\/[^/]+\/paldefender\/bases\/[^/]+\/delete$/.test(
          path,
        )) ||
      (method === "POST" &&
        /^\/api\/servers\/[^/]+\/paldefender\/test$/.test(path)) ||
      (method === "PUT" && /^\/api\/servers\/[^/]+$/.test(path)) ||
      (method === "DELETE" && /^\/api\/servers\/[^/]+$/.test(path))
    ) {
      return "manage_servers";
    }
    return method === "GET" || method === "HEAD" ? "read" : "manage_users";
  }
}
