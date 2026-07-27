import type { PalworldServerSettings } from "../types/connections.js";

export function isServerPasswordProtected(
  settings: Pick<PalworldServerSettings, "ServerPassword">,
): boolean | null {
  if (typeof settings.ServerPassword !== "string") {
    return null;
  }

  return settings.ServerPassword.trim().length > 0;
}
