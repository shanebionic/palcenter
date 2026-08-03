export interface CompanionCapability {
  supported: boolean;
  capabilityVersion: string;
}

export interface CompanionStatus {
  status: "connected" | "unavailable";
  checkedAt: string;
  reason: "not_installed" | "timeout" | "invalid_response" | null;
  health: {
    status: string;
    applicationVersion: string;
    apiVersion: string;
    startedAt: string;
    uptimeSeconds: number;
    instanceId: string | null;
    checks: Record<string, string>;
  } | null;
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
  } | null;
  capabilities: Record<string, CompanionCapability>;
}
