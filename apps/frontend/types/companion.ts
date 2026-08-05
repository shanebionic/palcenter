export type CompanionConnectionState =
  | "connected"
  | "disabled"
  | "unreachable"
  | "authentication_required"
  | "authentication_failed"
  | "malformed_response"
  | "incompatible_contract";
export interface CompanionCapability {
  supported: boolean;
  capabilityVersion: string;
}
export interface CompanionStatus {
  state: CompanionConnectionState;
  checkedAt: string;
  health: "healthy" | null;
  version: {
    applicationVersion: string;
    apiVersion: string;
    buildCommit: string | null;
    buildBranch: string | null;
    buildDate: string | null;
    compiler: string | null;
    palworldVersion: string | null;
    ue4ssVersion: string | null;
    compatibility: Record<string, string>;
    runtime: {
      startedAt: string;
      uptimeSeconds: number;
      instanceId: string | null;
      checks: Record<string, string>;
    } | null;
  } | null;
  capabilities: Record<string, CompanionCapability>;
  adminActions?: Record<string, boolean>;
  administratorPlayerId?: string | null;
}
