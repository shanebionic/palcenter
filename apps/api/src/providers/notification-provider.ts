import type { NotificationMessage } from "../types/notifications.js";

export interface NotificationProvider {
  send(message: NotificationMessage): Promise<void>;
}

export class NotificationDeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotificationDeliveryError";
  }
}

export async function sendRequest(
  url: string,
  init: RequestInit,
  providerName: string,
): Promise<void> {
  let response: Response;

  try {
    response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(8_000),
    });
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "Unknown connection error";
    throw new NotificationDeliveryError(
      `${providerName} could not be reached: ${reason}`,
    );
  }

  if (!response.ok) {
    throw new NotificationDeliveryError(
      `${providerName} returned HTTP ${response.status}.`,
    );
  }
}
