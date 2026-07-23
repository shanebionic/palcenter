import type { NotificationConfiguration } from "../types/notifications.js";

export interface NotificationRepository {
  initialize(): Promise<void>;
  list(): Promise<NotificationConfiguration[]>;
  get(id: string): Promise<NotificationConfiguration | null>;
  create(configuration: NotificationConfiguration): Promise<void>;
  update(configuration: NotificationConfiguration): Promise<void>;
  delete(id: string): Promise<void>;
}
