import type { CompanionStatus } from "../types/companion";

export function supportsMapTeleport(
  companion: CompanionStatus | null,
): boolean {
  return (
    companion?.state === "connected" &&
    companion.capabilities.adminActions?.capabilityVersion === "2" &&
    companion.adminActions?.teleportPlayerToLocation === true
  );
}
