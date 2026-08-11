import type { ServerConnectionUpdate } from "./api";

export function serverConnectionPayload(
  values: ServerConnectionUpdate,
): ServerConnectionUpdate {
  return {
    name: values.name,
    baseUrl: values.baseUrl,
    ...(values.adminPassword ? { adminPassword: values.adminPassword } : {}),
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
