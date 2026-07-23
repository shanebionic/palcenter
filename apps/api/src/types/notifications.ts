import type { ServerEventType } from "./connections.js";

export const notificationEventTypes = [
  "server_online",
  "server_offline",
  "server_restarted",
  "player_joined",
  "player_left",
  "player_banned",
] as const satisfies readonly ServerEventType[];

interface NotificationConfigurationBase {
  id: string;
  name: string;
  enabled: boolean;
  events: ServerEventType[];
  createdAt: string;
  updatedAt: string;
}

export interface DiscordNotificationConfiguration extends NotificationConfigurationBase {
  type: "discord";
  webhookUrl: string;
}

export interface NtfyNotificationConfiguration extends NotificationConfigurationBase {
  type: "ntfy";
  serverUrl: string;
  topic: string;
}

export type NotificationConfiguration =
  | DiscordNotificationConfiguration
  | NtfyNotificationConfiguration;

export type NotificationConfigurationInput =
  | Omit<DiscordNotificationConfiguration, "id" | "createdAt" | "updatedAt">
  | Omit<NtfyNotificationConfiguration, "id" | "createdAt" | "updatedAt">;

export type NotificationConfigurationUpdate =
  | (Omit<
      DiscordNotificationConfiguration,
      "id" | "createdAt" | "updatedAt" | "webhookUrl"
    > & { webhookUrl?: string })
  | Omit<NtfyNotificationConfiguration, "id" | "createdAt" | "updatedAt">;

export interface PublicDiscordNotificationConfiguration extends Omit<
  DiscordNotificationConfiguration,
  "webhookUrl"
> {
  webhookConfigured: boolean;
}

export type PublicNotificationConfiguration =
  | PublicDiscordNotificationConfiguration
  | NtfyNotificationConfiguration;

export interface NotificationFile {
  version: 1;
  providers: NotificationConfiguration[];
}

export interface NotificationMessage {
  title: string;
  body: string;
}
