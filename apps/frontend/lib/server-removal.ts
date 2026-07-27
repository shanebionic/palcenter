export const serverRemovalDescription =
  "This removes the saved server connection and its PalCenter-managed data. It does not stop, uninstall, or delete the remote Palworld server or its world files.";

export function serverRemovalTitle(serverName: string): string {
  return `Remove “${serverName}” from PalCenter?`;
}
