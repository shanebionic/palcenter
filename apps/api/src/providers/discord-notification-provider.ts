import type { NotificationMessage } from "../types/notifications.js";
import {
  sendRequest,
  type NotificationProvider,
} from "./notification-provider.js";

export class DiscordNotificationProvider implements NotificationProvider {
  constructor(private readonly webhookUrl: string) {}

  async send(message: NotificationMessage): Promise<void> {
    await sendRequest(
      this.webhookUrl,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `**${message.title}**\n${message.body}`,
        }),
      },
      "Discord",
    );
  }
}
