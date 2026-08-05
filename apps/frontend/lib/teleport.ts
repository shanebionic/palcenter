import type { CompanionStatus } from "../types/companion";

export function supportsMapTeleport(
  companion: CompanionStatus | null,
): boolean {
  return mapTeleportUnavailableReason(companion) === null;
}

export function mapTeleportUnavailableReason(
  companion: CompanionStatus | null,
): string | null {
  if (companion?.state !== "connected") {
    return "Companion must be connected before map teleport is available.";
  }
  if (companion.capabilities.adminActions?.capabilityVersion !== "2") {
    return "Companion must advertise admin-actions capability version 2 for safe map teleports.";
  }
  if (companion.adminActions?.teleportPlayerToLocation !== true) {
    return "Companion has not enabled safe map teleport. Enable TeleportPlayerToLocationEnabled and ensure the installed runtime supports it.";
  }
  return null;
}
