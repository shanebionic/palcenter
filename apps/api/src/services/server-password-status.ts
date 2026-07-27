import type { PalworldServerSettings } from "../types/connections.js";

export function isServerPasswordProtected(
  settings: Pick<PalworldServerSettings, "ServerPassword">,
): boolean {
  return (
    typeof settings.ServerPassword === "string" &&
    settings.ServerPassword.trim().length > 0
  );
}
