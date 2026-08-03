import type {
  ConnectedPlayer,
  PlayerPositionSnapshot,
  UserRole,
} from "../../types/servers";
import type {
  MapProjectionConfiguration,
  NormalizedMapPosition,
} from "./projection";
import {
  palpagosMapDefinition,
  projectOnMap,
  type WorldMapDefinition,
} from "./map-definitions";

export type TelemetryFreshness = "live" | "delayed" | "stale";
export type PlayerLocationAuthority = "standard" | "companion";

export function playerLocationAuthority(input: {
  companionConnected: boolean;
  coordinateSpaceCapabilitySupported: boolean;
  telemetryAuthoritative: boolean;
}): PlayerLocationAuthority {
  return input.companionConnected &&
    input.coordinateSpaceCapabilitySupported &&
    input.telemetryAuthoritative
    ? "companion"
    : "standard";
}
export type UnmappedPlayerReason =
  | "missing_telemetry"
  | "invalid_coordinates"
  | "outside_bounds"
  | "world_tree"
  | "instanced_area"
  | "unsupported_space"
  | "unknown_space"
  | "stale_position";
export type PlayerSpatialState =
  | "palpagos_live"
  | "world_tree_live"
  | "confirmed_instance"
  | "unsupported_space"
  | "unknown_space"
  | "stale_position"
  | "offline";

export interface LivePlayerMapMarker {
  userId: string;
  playerId: string | null;
  playerName: string;
  accountName: string | null;
  level: number | null;
  ping: number | null;
  buildingCount: number | null;
  worldX: number;
  worldY: number;
  position: NormalizedMapPosition;
  freshness: TelemetryFreshness;
  telemetryAt: string;
  coordinateSpaceId: string;
  spatialState: PlayerSpatialState;
  displayKind: "live" | "last_trusted_instance";
  reportedWorldX: number;
  reportedWorldY: number;
  locationAuthority: PlayerLocationAuthority;
}

export interface UnmappedPlayer {
  userId: string;
  playerName: string;
  reason: UnmappedPlayerReason;
  snapshot: PlayerPositionSnapshot | null;
  coordinateSpaceId: string;
  spatialState: PlayerSpatialState;
  lastTrustedPosition: PlayerPositionSnapshot | null;
}

export interface LivePlayerMapModel {
  markers: LivePlayerMapMarker[];
  unmappedPlayers: UnmappedPlayer[];
}

export interface MapAccess {
  canView: boolean;
  canCalibrate: boolean;
}

export type MapContentState =
  | "loading"
  | "offline"
  | "unavailable"
  | "empty"
  | "ready";

export interface PlayerMapDetailValues {
  playerName: string;
  accountName: string;
  playerId: string;
  userId: string;
  level: number | string;
  ping: string;
  buildingCount: number | string;
  worldCoordinates: string;
  telemetryAge: string;
}

export interface PlayerMarkerPresentation {
  displayName: string;
  initial: string;
  accessibleName: string;
}

export function playerMarkerPresentation(
  playerName: string | null | undefined,
): PlayerMarkerPresentation {
  const displayName = playerName?.trim() || "Unknown player";
  return {
    displayName,
    initial: Array.from(displayName)[0] ?? "?",
    accessibleName: `View ${displayName} on map`,
  };
}

export function mapAccessForRole(role: UserRole): MapAccess {
  return {
    canView: role === "administrator" || role === "moderator",
    canCalibrate: role === "administrator",
  };
}

export function mapContentState(input: {
  loading: boolean;
  serverOnline: boolean;
  playerRequestFailed: boolean;
  connectedPlayerCount: number;
}): MapContentState {
  if (input.loading) return "loading";
  if (!input.serverOnline) return "offline";
  if (input.playerRequestFailed) return "unavailable";
  if (input.connectedPlayerCount === 0) return "empty";
  return "ready";
}

export function playerMapDetailValues(
  marker: LivePlayerMapMarker,
  now = new Date(),
): PlayerMapDetailValues {
  return {
    playerName: marker.playerName,
    accountName: marker.accountName ?? "Account unavailable",
    playerId: marker.playerId ?? "Unavailable",
    userId: marker.userId,
    level: marker.level ?? "Unavailable",
    ping: marker.ping === null ? "Unavailable" : `${marker.ping} ms`,
    buildingCount: marker.buildingCount ?? "Unavailable",
    worldCoordinates: `X ${marker.worldX.toFixed(1)} · Y ${marker.worldY.toFixed(1)}`,
    telemetryAge: formatTelemetryAge(marker.telemetryAt, now),
  };
}

export function classifyTelemetryFreshness(
  telemetryAt: string,
  pollingIntervalSeconds: number,
  now = new Date(),
): TelemetryFreshness {
  const timestamp = Date.parse(telemetryAt);
  if (!Number.isFinite(timestamp)) return "stale";

  const ageSeconds = Math.max(0, (now.getTime() - timestamp) / 1_000);
  if (ageSeconds <= pollingIntervalSeconds * 2) return "live";
  if (ageSeconds <= 5 * 60) return "delayed";
  return "stale";
}

export function telemetryFreshnessLabel(freshness: TelemetryFreshness): string {
  switch (freshness) {
    case "live":
      return "Live";
    case "delayed":
      return "Delayed";
    case "stale":
      return "Stale";
  }
}

export function formatTelemetryAge(
  telemetryAt: string,
  now = new Date(),
): string {
  const timestamp = Date.parse(telemetryAt);
  if (!Number.isFinite(timestamp)) return "Unknown";

  const seconds = Math.max(0, Math.round((now.getTime() - timestamp) / 1_000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

export function buildLivePlayerMapModel(
  connectedPlayers: ConnectedPlayer[],
  telemetry: PlayerPositionSnapshot[],
  _configuration: MapProjectionConfiguration,
  pollingIntervalSeconds: number,
  verifiedAt: string | null,
  now = new Date(),
  trustedPositions: PlayerPositionSnapshot[] = [],
  mapDefinition: WorldMapDefinition = palpagosMapDefinition,
  locationAuthority: PlayerLocationAuthority = "standard",
): LivePlayerMapModel {
  const telemetryByUserId = new Map(
    telemetry.map((snapshot) => [snapshot.userId, snapshot]),
  );
  const markers: LivePlayerMapMarker[] = [];
  const unmappedPlayers: UnmappedPlayer[] = [];
  const trustedByUserId = new Map(
    trustedPositions
      .filter(
        (snapshot) =>
          snapshot.coordinateSpaceId === mapDefinition.coordinateSpaceId,
      )
      .map((snapshot) => [snapshot.userId, snapshot]),
  );

  for (const player of connectedPlayers) {
    const snapshot = telemetryByUserId.get(player.userId) ?? null;
    if (!snapshot) {
      unmappedPlayers.push({
        userId: player.userId,
        playerName: player.name,
        reason: "missing_telemetry",
        snapshot: null,
        coordinateSpaceId: "unknown",
        spatialState: "unknown_space",
        lastTrustedPosition: trustedByUserId.get(player.userId) ?? null,
      });
      continue;
    }

    const coordinateSpaceId = snapshot.coordinateSpaceId || "unknown";
    const freshness = classifyTelemetryFreshness(
      snapshot.capturedAt,
      pollingIntervalSeconds,
      now,
    );
    const isInstance = coordinateSpaceId.startsWith("instance:");
    const hasAuthoritativeSpace = locationAuthority === "companion";
    const spatialState: PlayerSpatialState =
      freshness === "stale"
        ? "stale_position"
        : coordinateSpaceId === "palpagos"
          ? "palpagos_live"
          : coordinateSpaceId === "world_tree"
            ? "world_tree_live"
            : isInstance
              ? "confirmed_instance"
              : coordinateSpaceId === "unknown"
                ? "unknown_space"
                : "unsupported_space";
    if (
      hasAuthoritativeSpace &&
      coordinateSpaceId !== mapDefinition.coordinateSpaceId
    ) {
      const lastTrustedPosition = trustedByUserId.get(player.userId) ?? null;
      unmappedPlayers.push({
        userId: player.userId,
        playerName: player.name,
        reason: isInstance
          ? "instanced_area"
          : coordinateSpaceId === "world_tree"
            ? "world_tree"
            : coordinateSpaceId === "unknown"
              ? "unknown_space"
              : "unsupported_space",
        snapshot,
        coordinateSpaceId,
        spatialState,
        lastTrustedPosition,
      });
      if (isInstance && lastTrustedPosition) {
        const trustedCoordinate =
          lastTrustedPosition.x === null || lastTrustedPosition.y === null
            ? null
            : { x: lastTrustedPosition.x, y: lastTrustedPosition.y };
        const trustedMapPosition = trustedCoordinate
          ? projectOnMap(mapDefinition, trustedCoordinate)
          : null;
        if (trustedCoordinate && trustedMapPosition) {
          markers.push({
            userId: snapshot.userId,
            playerId: snapshot.playerId,
            playerName: player.name,
            accountName: snapshot.accountName,
            level: snapshot.level,
            ping: snapshot.ping,
            buildingCount: snapshot.buildingCount,
            worldX: trustedCoordinate.x,
            worldY: trustedCoordinate.y,
            reportedWorldX: snapshot.x ?? 0,
            reportedWorldY: snapshot.y ?? 0,
            position: trustedMapPosition,
            freshness,
            telemetryAt: snapshot.capturedAt,
            coordinateSpaceId,
            spatialState,
            displayKind: "last_trusted_instance",
            locationAuthority,
          });
        }
      }
      continue;
    }

    const coordinate =
      snapshot.x === null || snapshot.y === null
        ? null
        : { x: snapshot.x, y: snapshot.y };
    if (
      !coordinate ||
      !Number.isFinite(coordinate.x) ||
      !Number.isFinite(coordinate.y)
    ) {
      unmappedPlayers.push({
        userId: player.userId,
        playerName: player.name,
        reason: "invalid_coordinates",
        snapshot,
        coordinateSpaceId,
        spatialState,
        lastTrustedPosition: trustedByUserId.get(player.userId) ?? null,
      });
      continue;
    }

    const position = projectOnMap(mapDefinition, coordinate);
    if (!position) {
      unmappedPlayers.push({
        userId: player.userId,
        playerName: player.name,
        reason: "outside_bounds",
        snapshot,
        coordinateSpaceId,
        spatialState,
        lastTrustedPosition: trustedByUserId.get(player.userId) ?? null,
      });
      continue;
    }

    const verifiedTimestamp = verifiedAt ? Date.parse(verifiedAt) : Number.NaN;
    const snapshotTimestamp = Date.parse(snapshot.capturedAt);
    const telemetryAt =
      Number.isFinite(verifiedTimestamp) &&
      (!Number.isFinite(snapshotTimestamp) ||
        verifiedTimestamp >= snapshotTimestamp)
        ? (verifiedAt as string)
        : snapshot.capturedAt;
    markers.push({
      userId: snapshot.userId,
      playerId: snapshot.playerId,
      playerName: player.name,
      accountName: snapshot.accountName,
      level: snapshot.level,
      ping: snapshot.ping,
      buildingCount: snapshot.buildingCount,
      worldX: coordinate.x,
      worldY: coordinate.y,
      reportedWorldX: coordinate.x,
      reportedWorldY: coordinate.y,
      position,
      freshness: classifyTelemetryFreshness(
        telemetryAt,
        pollingIntervalSeconds,
        now,
      ),
      telemetryAt,
      coordinateSpaceId,
      spatialState,
      displayKind: "live",
      locationAuthority,
    });
  }

  return { markers, unmappedPlayers };
}

export function calibrationRecord(marker: LivePlayerMapMarker): string {
  return [
    `Player: ${marker.playerName}`,
    `World: ${marker.worldX}, ${marker.worldY}`,
    `Normalized: ${marker.position.x.toFixed(4)}, ${marker.position.y.toFixed(4)}`,
    `Map: ${(marker.position.x * 100).toFixed(2)}%, ${(marker.position.y * 100).toFixed(2)}%`,
  ].join("\n");
}
