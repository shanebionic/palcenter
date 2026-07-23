import type { ServerEventType } from "../types/servers";

export const notificationEventOptions: {
  value: ServerEventType;
  label: string;
}[] = [
  { value: "server_online", label: "Server online" },
  { value: "server_offline", label: "Server offline" },
  { value: "server_restarted", label: "Server restarted" },
  { value: "player_joined", label: "Player joined" },
  { value: "player_left", label: "Player left" },
  { value: "player_banned", label: "Player banned" },
];

const notificationEventLabels = new Map(
  notificationEventOptions.map((event) => [event.value, event.label]),
);

export function notificationEventLabel(event: ServerEventType): string {
  return notificationEventLabels.get(event) ?? event;
}
