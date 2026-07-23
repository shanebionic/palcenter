import type { NotificationMessage } from "../types/notifications.js";
import {
  sendRequest,
  type NotificationProvider,
} from "./notification-provider.js";

export class NtfyNotificationProvider implements NotificationProvider {
  constructor(
    private readonly serverUrl: string,
    private readonly topic: string,
  ) {}

  async send(message: NotificationMessage): Promise<void> {
    const url = `${this.serverUrl.replace(/\/+$/, "")}/${encodeURIComponent(
      this.topic,
    )}`;

    await sendRequest(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          Title: message.title,
        },
        body: message.body,
      },
      "ntfy",
    );
  }
}
