import type { ServerConnectionUpdate } from "./api";

export function serverConnectionPayload(
  values: ServerConnectionUpdate,
): ServerConnectionUpdate {
  return {
    name: values.name,
    baseUrl: values.baseUrl,
    ...(values.adminPassword ? { adminPassword: values.adminPassword } : {}),
  };
}

export const untestedConnectionWarning =
  "The current connection details have not passed a connection test. Save them anyway? This is useful when preparing a server that is currently offline.";
