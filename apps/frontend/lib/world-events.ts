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
  player_rapid_relocation: "Rapid relocation detected",
};

export function worldEventLabel(event: WorldEvent): string {
  if (event.type !== "player_rapid_relocation") {
    return worldEventLabels[event.type];
  }
  const classification = event.metadata.classification;
  const direction = event.metadata.transitionDirection;
  const destinationSpace = event.metadata.destinationCoordinateSpaceId;
  if (classification === "likely_fast_travel") return "Likely fast travel";
  if (classification === "likely_instance_transition") {
    return direction === "exit"
      ? "Exited an instanced area"
      : "Entered an instanced area";
  }
  if (classification === "likely_map_transition") {
    return direction === "exit" && destinationSpace === "palpagos"
      ? "Returned to the overworld"
      : "Changed map area";
  }
  return "Rapid relocation detected";
}

export function worldEventSentence(event: WorldEvent): string {
  const player = worldEventPlayerName(event);
  if (event.type === "player_joined") return `${player} joined the server.`;
  if (event.type === "player_disconnected") {
    return event.metadata.departureKind === "left"
      ? `${player} left the server.`
      : `${player} disconnected.`;
  }
  if (event.type === "session_started") return `${player} came online.`;
  if (event.type === "session_ended") {
    const duration = event.metadata.durationSeconds;
    return typeof duration === "number"
      ? `${player}'s session ended after ${formatActivityDuration(duration)}.`
      : `${player}'s session ended.`;
  }
  return `${player}: ${worldEventLabel(event)}.`;
}

export function formatActivityDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainder = seconds % 60;
  const parts: string[] = [];
  if (hours) parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
  if (minutes) parts.push(`${minutes} ${minutes === 1 ? "minute" : "minutes"}`);
  if (!hours && !minutes) {
    parts.push(`${remainder} ${remainder === 1 ? "second" : "seconds"}`);
  }
  return parts.join(" ");
}

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
  if (evidence.fact === "server_hook") {
    return "Reported directly by Palworld through PalCenter Companion.";
  }
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
  if (evidence.fact === "rapid_displacement") {
    return `Player moved ${evidence.value}.`;
  }
  if (evidence.fact === "implied_speed") {
    return `Implied travel speed was ${evidence.value}.`;
  }
  if (evidence.fact === "observation_continuous") {
    return `Observation continuity remained intact: ${evidence.value}.`;
  }
  if (evidence.fact === "coordinate_space_changed") {
    return `Coordinate space changed from ${evidence.value}.`;
  }
  if (evidence.fact === "transition_signature_matched") {
    return `Matched verified transition signature: ${evidence.value}.`;
  }
  return "An explicit player state change was reported by the server.";
}

export function worldEventCoordinateSpace(
  event: WorldEvent,
  endpoint: "origin" | "destination",
): string | null {
  const value = event.metadata[`${endpoint}CoordinateSpaceId`];
  return typeof value === "string" && value.trim() ? value : null;
}

export function worldEventPositionSupportsPalpagosMap(
  event: WorldEvent,
  endpoint: "origin" | "destination",
): boolean {
  return worldEventCoordinateSpace(event, endpoint) === "palpagos";
}

export function worldEventRelocationPosition(
  event: WorldEvent,
  endpoint: "origin" | "destination",
): WorldEvent["position"] {
  if (event.type !== "player_rapid_relocation") return null;
  const x = event.metadata[`${endpoint}X`];
  const y = event.metadata[`${endpoint}Y`];
  return typeof x === "number" && typeof y === "number"
    ? { x, y, z: null }
    : null;
}

export function worldEventMetadataText(
  key: string,
  value: string | number | boolean | null,
): string {
  if (key === "classification") {
    const labels: Record<string, string> = {
      likely_fast_travel: "Likely fast travel",
      likely_admin_teleport: "Likely administrator teleport",
      likely_instance_transition: "Likely instance transition",
      likely_map_transition: "Likely map transition",
      unexplained_relocation: "Movement discontinuity (cause unknown)",
    };
    return `Classification: ${labels[String(value)] ?? String(value)}`;
  }
  if (key === "originTimestamp" && typeof value === "string") {
    return `Origin sample: ${exactWorldEventTime(value)}`;
  }
  if (key === "elapsedSeconds") return `Elapsed time: ${String(value)} seconds`;
  if (key === "displacement") return `Distance: ${String(value)} world units`;
  if (key === "impliedSpeed") {
    return `Implied speed: ${String(value)} world units per second`;
  }
  if (key === "originCoordinateSpaceId") {
    return `Origin coordinate space: ${String(value)}`;
  }
  if (key === "destinationCoordinateSpaceId") {
    return `Destination coordinate space: ${String(value)}`;
  }
  if (key === "matchedTransitionDisplayName") {
    return `Matched transition: ${String(value)}`;
  }
  if (key === "transitionDirection") {
    return `Transition direction: ${String(value)}`;
  }
  if (key === "transitionType") {
    return `Transition type: ${String(value).replaceAll("_", " ")}`;
  }
  if (key === "sessionId") return `Session ID: ${String(value)}`;
  if (key === "activitySource") {
    return `Activity source: ${value === "companion" ? "PalCenter Companion" : "Standard server information"}`;
  }
  if (key === "departureKind") return `Departure: ${String(value)}`;
  if (key === "durationSeconds" && typeof value === "number") {
    return `Online duration: ${formatActivityDuration(value)}`;
  }
  return `${key}: ${String(value)}`;
}

export function sortWorldEventsNewestFirst(events: WorldEvent[]): WorldEvent[] {
  return [...events].sort(
    (left, right) =>
      Date.parse(right.timestamp) - Date.parse(left.timestamp) ||
      sameTimestampOrder(left.type) - sameTimestampOrder(right.type) ||
      right.id.localeCompare(left.id),
  );
}

function sameTimestampOrder(type: WorldEventType): number {
  if (type === "player_idle_ended" || type === "player_afk_ended") return 0;
  if (type === "player_rapid_relocation") return 1;
  return 0;
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
