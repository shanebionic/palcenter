export const auditCategories = [
  "players",
  "moderation",
  "messaging",
  "server",
  "bases",
] as const;
export type AuditCategory = (typeof auditCategories)[number];
export type AuditResult = "success" | "failed";

export interface AuditEntry {
  id: number;
  serverId: string;
  actorUserId: string;
  actorUsername: string;
  occurredAt: string;
  action: string;
  category: AuditCategory;
  targetType: string | null;
  targetId: string | null;
  result: AuditResult;
  details: Record<string, unknown>;
}

export type NewAuditEntry = Omit<AuditEntry, "id">;

export interface AuditQuery {
  actorUserId?: string;
  category?: AuditCategory;
  result?: AuditResult;
  from?: string;
  to?: string;
  search?: string;
  limit: number;
}

declare module "fastify" {
  interface FastifyRequest {
    // Non-secret, route-supplied audit details. Routes must never put
    // secrets (tokens, message text, reasons, full IPs) in here.
    auditDetails?: Record<string, unknown>;
  }
}
