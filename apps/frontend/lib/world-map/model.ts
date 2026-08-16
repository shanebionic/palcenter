import type { PalDefenderBase } from "../../lib/api";
import { canonicalPlayerId } from "../../lib/player-identity";
import type {
  ConnectedPlayer,
  PlayerPositionSnapshot,
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
export type PlayerLocationAuthority = "standard";
export type UnmappedPlayerReason =
  | "missing_telemetry"
  | "invalid_coordinates"
  | "outside_bounds"
  | "world_tree"
  | "palpagos"
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
  guildId: string | null;
  guildName: string | null;
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
  mapCoordinates: string;
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

export interface PlayerEnrichment {
  mapLocation: { x?: number; y?: number; z?: number } | null;
  level: number | null;
}

export function playerMapDetailValues(
  marker: LivePlayerMapMarker,
  options: { now?: Date; enrichment?: PlayerEnrichment | null } = {},
): PlayerMapDetailValues {
  const now = options.now ?? new Date();
  const enrichment = options.enrichment;
  const mapLocation = enrichment?.mapLocation ?? null;
  const mapCoordinates =
    mapLocation &&
    mapLocation.x != null &&
    mapLocation.y != null &&
    Number.isFinite(mapLocation.x) &&
    Number.isFinite(mapLocation.y)
      ? `X ${mapLocation.x.toFixed(1)} · Y ${mapLocation.y.toFixed(1)}${mapLocation.z != null && Number.isFinite(mapLocation.z) ? ` · Z ${mapLocation.z.toFixed(1)}` : ""}`
      : "Unavailable";
  const level = enrichment?.level ?? marker.level ?? "Unavailable";
  return {
    playerName: marker.playerName,
    accountName: marker.accountName ?? "Account unavailable",
    playerId: marker.playerId ?? "Unavailable",
    userId: marker.userId,
    level,
    ping: marker.ping === null ? "Unavailable" : `${marker.ping} ms`,
    buildingCount: marker.buildingCount ?? "Unavailable",
    worldCoordinates: `X ${marker.worldX.toFixed(1)} · Y ${marker.worldY.toFixed(1)}`,
    mapCoordinates,
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
  const telemetryByCanonicalPlayerId = new Map(
    telemetry.map((snapshot) => [
      canonicalPlayerId(snapshot.playerId || ""),
      snapshot,
    ]),
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
    let snapshot = telemetryByUserId.get(player.userId) ?? null;
    if (!snapshot && player.playerId) {
      const canonicalId = canonicalPlayerId(player.playerId);
      if (canonicalId && canonicalId !== "none") {
        snapshot = telemetryByCanonicalPlayerId.get(canonicalId) ?? null;
      }
    }
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
    const isInstance =
      coordinateSpaceId === "special_area" ||
      coordinateSpaceId.startsWith("instance:");
    const isMappableAuthoritativeSpace =
      coordinateSpaceId === "palpagos" || coordinateSpaceId === "world_tree";
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
      isMappableAuthoritativeSpace &&
      coordinateSpaceId !== mapDefinition.coordinateSpaceId
    ) {
      const lastTrustedPosition = trustedByUserId.get(player.userId) ?? null;
      unmappedPlayers.push({
        userId: player.userId,
        playerName: player.name,
        reason: coordinateSpaceId === "world_tree" ? "world_tree" : "palpagos",
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
            guildId: snapshot.guildId,
            guildName: snapshot.guildName,
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

    const telemetryAt = snapshot.capturedAt;
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
      guildId: snapshot.guildId,
      guildName: snapshot.guildName,
      locationAuthority,
    });
  }

  return { markers, unmappedPlayers };
}

export interface BaseMapMarker {
  baseId: string;
  guildId: string;
  guildName: string | null;
  worldX: number;
  worldY: number;
  position: NormalizedMapPosition;
  mapPosition: { x: number; y: number; z: number } | null;
}

export function buildBaseMapMarkers(
  bases: PalDefenderBase[],
  projection: MapProjectionConfiguration,
  mapDefinition: WorldMapDefinition = palpagosMapDefinition,
): BaseMapMarker[] {
  // Base DTOs carry no coordinate-space field, so base positions are only
  // interpreted on maps whose coordinate space is verified for bases —
  // currently Palpagos. World Tree base markers must not be guessed from
  // Palpagos coordinates that happen to fall inside the tree bounds.
  if (mapDefinition.coordinateSpaceId !== "palpagos") return [];

  const markers: BaseMapMarker[] = [];

  for (const base of bases) {
    const { worldPosition } = base;
    if (
      !Number.isFinite(worldPosition.x) ||
      !Number.isFinite(worldPosition.y)
    ) {
      continue;
    }

    const coordinate = { x: worldPosition.x, y: worldPosition.y };
    const position = projectOnMap(mapDefinition, coordinate);
    if (!position) continue;

    markers.push({
      baseId: base.baseId,
      guildId: base.guildId,
      guildName: base.guildName,
      worldX: worldPosition.x,
      worldY: worldPosition.y,
      position,
      mapPosition: base.mapPosition
        ? {
            x: base.mapPosition.x,
            y: base.mapPosition.y,
            z: base.mapPosition.z,
          }
        : null,
    });
  }

  return markers;
}

export type MapLocationKind = "on-map" | "other-map" | "unavailable";

export interface MapLocationStatus {
  kind: MapLocationKind;
  label: string;
  targetMapId: "palpagos" | "world_tree" | null;
}

export const UNAVAILABLE_PLAYER_LOCATION_LABEL = "Location unavailable";

export interface OtherMapPlayerCopy {
  statusLabel: string;
  viewLabel: string;
  targetMapId: "palpagos" | "world_tree";
}

const otherMapCopy: Record<"palpagos" | "world_tree", OtherMapPlayerCopy> = {
  palpagos: {
    statusLabel: "On Palpagos",
    viewLabel: "View on Palpagos",
    targetMapId: "palpagos",
  },
  world_tree: {
    statusLabel: "In World Tree",
    viewLabel: "View on World Tree",
    targetMapId: "world_tree",
  },
};

const onMapPreposition: Record<"palpagos" | "world_tree", string> = {
  palpagos: "On",
  world_tree: "In",
};

export function isCrossMapUnmappedReason(
  reason: UnmappedPlayerReason,
): reason is "palpagos" | "world_tree" {
  return reason === "palpagos" || reason === "world_tree";
}

export function otherMapPlayerCopy(
  reason: UnmappedPlayerReason,
): OtherMapPlayerCopy | null {
  if (isCrossMapUnmappedReason(reason)) return otherMapCopy[reason];
  return null;
}

export function mapLocationStatus(input: {
  onMap: boolean;
  unmappedReason: UnmappedPlayerReason | null;
  activeMapId: "palpagos" | "world_tree";
  activeMapName: string;
}): MapLocationStatus {
  if (input.onMap) {
    return {
      kind: "on-map",
      label: `${onMapPreposition[input.activeMapId]} ${input.activeMapName}`,
      targetMapId: null,
    };
  }
  if (
    input.unmappedReason !== null &&
    isCrossMapUnmappedReason(input.unmappedReason)
  ) {
    return {
      kind: "other-map",
      label: otherMapCopy[input.unmappedReason].statusLabel,
      targetMapId: input.unmappedReason,
    };
  }
  return {
    kind: "unavailable",
    label: UNAVAILABLE_PLAYER_LOCATION_LABEL,
    targetMapId: null,
  };
}
