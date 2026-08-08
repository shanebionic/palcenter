import type { ServerConnectionUpdate } from "./api";

export function serverConnectionPayload(
  values: ServerConnectionUpdate,
): ServerConnectionUpdate {
  return {
    name: values.name,
    baseUrl: values.baseUrl,
    ...(values.adminPassword ? { adminPassword: values.adminPassword } : {}),
    ...(values.companionEnabled !== undefined
      ? { companionEnabled: values.companionEnabled }
      : {}),
    ...(values.companionHost !== undefined
      ? { companionHost: values.companionHost?.trim() || null }
      : {}),
    ...(values.companionPort !== undefined
      ? { companionPort: values.companionPort }
      : {}),
    ...(values.companionApiToken
      ? { companionApiToken: values.companionApiToken }
      : {}),
    ...(values.administratorPlayerId !== undefined
      ? { administratorPlayerId: values.administratorPlayerId }
      : {}),
    ...(values.palDefenderEnabled !== undefined
      ? { palDefenderEnabled: values.palDefenderEnabled }
      : {}),
    ...(values.palDefenderEndpoint !== undefined
      ? { palDefenderEndpoint: values.palDefenderEndpoint?.trim() || null }
      : {}),
    ...(values.palDefenderToken
      ? { palDefenderToken: values.palDefenderToken }
      : {}),
    ...(values.clearPalDefenderToken ? { clearPalDefenderToken: true } : {}),
  };
}

export const untestedConnectionWarning =
  "The current connection details have not passed a connection test. Save them anyway? This is useful when preparing a server that is currently offline.";
