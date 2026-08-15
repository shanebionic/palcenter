import type { FastifyRequest } from "fastify";
import type { AuditCategory, NewAuditEntry } from "../types/audit.js";

interface Definition {
  action: string;
  category: AuditCategory;
  targetType?: string;
  targetParameter?: string;
}

const definitions: Record<string, Definition> = {
  "/api/servers/:serverId/paldefender/bases/:baseId/delete": {
    action: "delete_base",
    category: "bases",
    targetType: "base",
    targetParameter: "baseId",
  },
  "/api/servers/:serverId/paldefender/players/:playerId/technology/learn": {
    action: "learn_technology",
    category: "players",
    targetType: "player",
    targetParameter: "playerId",
  },
  "/api/servers/:serverId/paldefender/players/:playerId/technology/forget": {
    action: "forget_technology",
    category: "players",
    targetType: "player",
    targetParameter: "playerId",
  },
  "/api/servers/:serverId/paldefender/players/:playerId/progression": {
    action: "give_progression",
    category: "players",
    targetType: "player",
    targetParameter: "playerId",
  },
  "/api/servers/:serverId/paldefender/players/:playerId/items": {
    action: "give_items",
    category: "players",
    targetType: "player",
    targetParameter: "playerId",
  },
  "/api/servers/:serverId/paldefender/players/:playerId/pals": {
    action: "give_pal",
    category: "players",
    targetType: "player",
    targetParameter: "playerId",
  },
  "/api/servers/:serverId/paldefender/players/:playerId/pal-templates": {
    action: "give_pal_template",
    category: "players",
    targetType: "player",
    targetParameter: "playerId",
  },
  "/api/servers/:serverId/paldefender/players/:playerId/pal-eggs": {
    action: "give_pal_egg",
    category: "players",
    targetType: "player",
    targetParameter: "playerId",
  },
  "/api/servers/:serverId/paldefender/players/:playerId/kick": {
    action: "kick_player",
    category: "moderation",
    targetType: "player",
    targetParameter: "playerId",
  },
  "/api/servers/:serverId/paldefender/players/:playerId/ban": {
    action: "ban_player",
    category: "moderation",
    targetType: "player",
    targetParameter: "playerId",
  },
  "/api/servers/:serverId/moderation/users/:userId/unban": {
    action: "unban_player",
    category: "moderation",
    targetType: "player",
    targetParameter: "userId",
  },
  "/api/servers/:serverId/moderation/ip/ban": {
    action: "ban_ip",
    category: "moderation",
    targetType: "IP address",
  },
  "/api/servers/:serverId/moderation/ip/unban": {
    action: "unban_ip",
    category: "moderation",
    targetType: "IP address",
  },
  "/api/servers/:serverId/paldefender/broadcast": {
    action: "broadcast",
    category: "messaging",
  },
  "/api/servers/:serverId/paldefender/alert": {
    action: "alert",
    category: "messaging",
  },
  "/api/servers/:serverId/paldefender/player-message": {
    action: "send_player_message",
    category: "messaging",
    targetType: "player",
  },
  "/api/servers/:serverId/paldefender/reload-config": {
    action: "reload_paldefender",
    category: "server",
  },
  "/api/servers/:id/admin/announce": {
    action: "native_broadcast",
    category: "messaging",
  },
  "/api/servers/:id/admin/save": { action: "save_world", category: "server" },
  "/api/servers/:id/admin/shutdown": {
    action: "shutdown_server",
    category: "server",
  },
  "/api/servers/:id/admin/stop": {
    action: "force_stop_server",
    category: "server",
  },
  "/api/servers/:id/players/:playerId/kick": {
    action: "native_kick_player",
    category: "moderation",
    targetType: "player",
    targetParameter: "playerId",
  },
  "/api/servers/:id/players/:playerId/ban": {
    action: "native_ban_player",
    category: "moderation",
    targetType: "player",
    targetParameter: "playerId",
  },
  "/api/servers/:id/players/:playerId/unban": {
    action: "native_unban_player",
    category: "moderation",
    targetType: "player",
    targetParameter: "playerId",
  },
};

export function administrativeAuditEntry(
  request: FastifyRequest,
  statusCode: number,
  actor: { id: string; username: string },
): NewAuditEntry | null {
  if (request.method !== "POST") return null;
  const route = request.routeOptions.url;
  if (!route) return null;
  const definition = definitions[route];
  if (!definition) return null;
  const params = (request.params ?? {}) as Record<string, string>;
  const serverId = params.serverId ?? params.id;
  if (!serverId) return null;
  const body = (request.body ?? {}) as Record<string, unknown>;
  const targetParameter = definition.targetParameter;
  const details: Record<string, unknown> = {};
  if (Array.isArray(body.playerIds))
    details.recipientCount = body.playerIds.length;
  if (typeof body.sendType === "string") details.messageType = body.sendType;
  if (typeof body.scope === "string") details.scope = body.scope;
  if (
    request.palDefenderCredentialSource === "user" ||
    request.palDefenderCredentialSource === "server_default"
  ) {
    details.palDefenderCredentialSource = request.palDefenderCredentialSource;
  }
  // Message text, reasons, Bearer tokens, and full IP addresses are deliberately excluded.
  return {
    serverId,
    actorUserId: actor.id,
    actorUsername: actor.username,
    occurredAt: new Date().toISOString(),
    action: definition.action,
    category: definition.category,
    targetType: definition.targetType ?? null,
    targetId: targetParameter ? (params[targetParameter] ?? null) : null,
    result: statusCode >= 200 && statusCode < 400 ? "success" : "failed",
    details,
  };
}
