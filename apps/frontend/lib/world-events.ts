import type {
  WorldEvent,
  WorldEventQuery,
  WorldEventType,
} from "../types/servers";

export const worldEventLabels: Record<WorldEventType, string> = {
  player_joined: "Player joined",
  player_disconnected: "Player disconnected",
  session_started: "Session started",
  session_ended: "Session ended",
  player_died: "Player died",
  player_respawned: "Player respawned",
  player_idle_started: "Player became idle",
  player_idle_ended: "Player resumed activity",
  player_afk_started: "Prolonged inactivity detected",
  player_afk_ended: "Activity resumed",
};

export function worldEventConfidence(confidence: number): {
  label: string;
  color: string;
} {
  if (confidence >= 1) return { label: "Confirmed", color: "cyan" };
  if (confidence >= 0.8) return { label: "High confidence", color: "blue" };
  if (confidence >= 0.5)
    return { label: "Moderate confidence", color: "yellow" };
  return { label: "Low confidence", color: "orange" };
}

export function worldEventPlayerName(event: WorldEvent): string {
  const name = event.metadata.playerName;
  return typeof name === "string" && name.trim() ? name : event.userId;
}

export function worldEventEvidenceText(
  evidence: WorldEvent["evidence"][number],
): string {
  if (evidence.fact === "appeared") {
    return "Player appeared in the online roster.";
  }
  if (evidence.fact === "disappeared") {
    return "Player disappeared from the online roster.";
  }
  if (evidence.fact === "within_radius") {
    return `Player remained within ${evidence.value}.`;
  }
  if (evidence.fact === "roster_present") {
    return "Player remained present in the online roster.";
  }
  if (evidence.fact === "moved_beyond_radius") {
    return `Player moved ${evidence.value}, beyond the inactivity radius.`;
  }
  if (evidence.fact === "prior_state") {
    return `Prior activity state was ${evidence.value}.`;
  }
  return "An explicit player state change was reported by the server.";
}

export function sortWorldEventsNewestFirst(events: WorldEvent[]): WorldEvent[] {
  return [...events].sort(
    (left, right) =>
      Date.parse(right.timestamp) - Date.parse(left.timestamp) ||
      right.id.localeCompare(left.id),
  );
}

export function mergeWorldEventPages(
  current: WorldEvent[],
  next: WorldEvent[],
): WorldEvent[] {
  return sortWorldEventsNewestFirst([
    ...new Map(
      [...current, ...next].map((event) => [event.id, event]),
    ).values(),
  ]);
}

export function buildWorldEventQuery(query: WorldEventQuery): string {
  const parameters = new URLSearchParams();
  if (query.userId?.trim()) parameters.set("userId", query.userId.trim());
  if (query.type) parameters.set("type", query.type);
  if (query.from) parameters.set("from", query.from);
  if (query.to) parameters.set("to", query.to);
  parameters.set("limit", String(query.limit ?? 50));
  return parameters.toString();
}

export function exactWorldEventTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "full",
    timeStyle: "long",
  }).format(new Date(value));
}

export function relativeWorldEventTime(
  value: string,
  now = new Date(),
): string {
  const seconds = Math.round((Date.parse(value) - now.getTime()) / 1_000);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (Math.abs(seconds) < 60) return formatter.format(seconds, "second");
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  return formatter.format(Math.round(hours / 24), "day");
}

export function worldEventTimeRangeFromNow(
  range: "1h" | "6h" | "24h" | "7d" | "all",
  now = new Date(),
): string | undefined {
  const durations = {
    "1h": 60 * 60 * 1_000,
    "6h": 6 * 60 * 60 * 1_000,
    "24h": 24 * 60 * 60 * 1_000,
    "7d": 7 * 24 * 60 * 60 * 1_000,
  } as const;
  return range === "all"
    ? undefined
    : new Date(now.getTime() - durations[range]).toISOString();
}
