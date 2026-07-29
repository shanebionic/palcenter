"use client";

import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Center,
  Code,
  Group,
  Loader,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconCopy,
  IconArrowsMaximize,
  IconFocusCentered,
  IconMinus,
  IconPlus,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  getPlayers,
  getPlayerTelemetry,
  getPlayerTrailHistory,
} from "../lib/api";
import {
  buildLivePlayerMapModel,
  calibrationRecord,
  mapContentState,
  playerMapDetailValues,
  playerMarkerPresentation,
  telemetryFreshnessLabel,
  type LivePlayerMapMarker,
} from "../lib/world-map/model";
import {
  centerMapOnPosition,
  clampMapZoom,
  constrainMapPan,
  fitMapView,
  mapSurfaceSize,
  markerInverseScale,
  rectanglesIntersect,
  zoomMapAtPointer,
  type MapPan,
  type MapRect,
} from "../lib/world-map/navigation";
import {
  defaultWorldMapLayer,
  worldMapAssetPath,
  worldMapAssetSrcSet,
  worldMapLayerClasses,
  type WorldMapLayer,
} from "../lib/world-map/layers";
import { palpagosProjection } from "../lib/world-map/projection";
import { playerColor } from "../lib/world-map/player-color";
import {
  buildRenderedTrailSegments,
  processMovementTrail,
  type ProcessedTrail,
} from "../lib/world-map/trail";
import type { ConnectedPlayer, LatestPlayerTelemetry } from "../types/servers";

interface ServerWorldMapProps {
  serverId: string;
  serverOnline: boolean;
  canCalibrate: boolean;
}

const defaultTelemetry: LatestPlayerTelemetry = {
  players: [],
  pollingIntervalSeconds: 30,
  lastCollectedAt: null,
};

type TrailRange = "15m" | "1h" | "6h" | "24h";
const trailRangeMilliseconds: Record<TrailRange, number> = {
  "15m": 15 * 60 * 1_000,
  "1h": 60 * 60 * 1_000,
  "6h": 6 * 60 * 60 * 1_000,
  "24h": 24 * 60 * 60 * 1_000,
};

export function ServerWorldMap({
  serverId,
  serverOnline,
  canCalibrate,
}: ServerWorldMapProps) {
  const [players, setPlayers] = useState<ConnectedPlayer[]>([]);
  const [telemetry, setTelemetry] =
    useState<LatestPlayerTelemetry>(defaultTelemetry);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playerRequestFailed, setPlayerRequestFailed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [calibrating, setCalibrating] = useState(false);
  const [mapLayer, setMapLayer] = useState<WorldMapLayer>(defaultWorldMapLayer);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<MapPan>({ x: 0, y: 0 });
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [expanded, setExpanded] = useState(false);
  const [focusedPlayerId, setFocusedPlayerId] = useState<string | null>(null);
  const [trailEnabled, setTrailEnabled] = useState(false);
  const [trailRange, setTrailRange] = useState<TrailRange>("1h");
  const [trail, setTrail] = useState<ProcessedTrail | null>(null);
  const [trailLoading, setTrailLoading] = useState(false);
  const [trailError, setTrailError] = useState<string | null>(null);
  const [trailTruncated, setTrailTruncated] = useState(false);
  const trailRequest = useRef<AbortController | null>(null);
  const [diagnostics, setDiagnostics] = useState<{
    viewport: MapRect;
    surface: MapRect;
    image: MapRect | null;
    marker: MapRect | null;
    untransformedSurface: { width: number; height: number };
    markerPlane: { width: number; height: number };
    viewportClient: { width: number; height: number };
    viewportCss: {
      width: string;
      height: string;
      minHeight: string;
      maxHeight: string;
      aspectRatio: string;
    };
    expanded: boolean;
    visible: boolean;
  } | null>(null);
  const viewport = useRef<HTMLDivElement | null>(null);
  const surface = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{
    pointerId: number;
    x: number;
    y: number;
    pan: MapPan;
  } | null>(null);

  const loadMap = useCallback(
    async (background = false) => {
      if (background) setRefreshing(true);
      setError(null);
      setPlayerRequestFailed(false);

      const [playersResult, telemetryResult] = await Promise.allSettled([
        getPlayers(serverId),
        getPlayerTelemetry(serverId),
      ]);

      if (playersResult.status === "fulfilled") {
        setPlayers(playersResult.value);
      } else {
        setPlayers([]);
        setPlayerRequestFailed(true);
        setError(
          playersResult.reason instanceof Error
            ? playersResult.reason.message
            : "Unable to load connected players.",
        );
      }

      if (telemetryResult.status === "fulfilled") {
        setTelemetry(telemetryResult.value);
      } else {
        setTelemetry(defaultTelemetry);
        setError((current) =>
          current
            ? `${current} Position telemetry is also unavailable.`
            : "Position telemetry is unavailable.",
        );
      }

      setLoading(false);
      setRefreshing(false);
    },
    [serverId],
  );

  useEffect(() => {
    if (!serverOnline) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      await loadMap(true);
      if (!cancelled) {
        timeout = setTimeout(
          poll,
          Math.max(5, telemetry.pollingIntervalSeconds) * 1_000,
        );
      }
    };

    void loadMap().then(() => {
      if (!cancelled) {
        timeout = setTimeout(
          poll,
          Math.max(5, telemetry.pollingIntervalSeconds) * 1_000,
        );
      }
    });

    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [loadMap, serverOnline, telemetry.pollingIntervalSeconds]);

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;

    const updateSize = () => {
      const bounds = element.getBoundingClientRect();
      const nextSize = {
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
      };
      setViewportSize((current) => {
        if (
          (current.width === 0 && nextSize.width > 0 && nextSize.height > 0) ||
          (current.width > 0 &&
            (Math.abs(current.width - nextSize.width) > 160 ||
              Math.abs(current.height - nextSize.height) > 160))
        ) {
          setZoom(1);
          setPan({ x: 0, y: 0 });
        }
        return nextSize;
      });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [loading, serverOnline]);

  useEffect(() => {
    if (!expanded) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [expanded]);

  const model = useMemo(
    () =>
      buildLivePlayerMapModel(
        players,
        telemetry.players,
        palpagosProjection,
        telemetry.pollingIntervalSeconds,
        telemetry.lastCollectedAt,
      ),
    [players, telemetry],
  );
  const selected =
    model.markers.find((marker) => marker.userId === selectedId) ?? null;
  const selectedTelemetry =
    telemetry.players.find((snapshot) => snapshot.userId === selectedId) ??
    null;
  const selectedPlayerName =
    selected?.playerName ?? selectedTelemetry?.playerName ?? null;
  const selectedPlayerColor = playerColor(selectedId ?? "");
  const renderedTrailSegments = useMemo(
    () => (trail ? buildRenderedTrailSegments(trail) : []),
    [trail],
  );
  const contentState = mapContentState({
    loading,
    serverOnline,
    playerRequestFailed,
    connectedPlayerCount: players.length,
  });
  const displayedContentState =
    contentState === "empty" && telemetry.players.length > 0
      ? "ready"
      : contentState;

  const surfaceSize = mapSurfaceSize(viewportSize);

  const loadTrail = useCallback(
    async (userId: string, range: TrailRange) => {
      trailRequest.current?.abort();
      const controller = new AbortController();
      trailRequest.current = controller;
      setTrailLoading(true);
      setTrailError(null);
      const end = new Date();
      const start = new Date(end.getTime() - trailRangeMilliseconds[range]);
      try {
        const history = await getPlayerTrailHistory(
          serverId,
          userId,
          start.toISOString(),
          end.toISOString(),
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setTrail(
          processMovementTrail(history.points, palpagosProjection, {
            pollingIntervalSeconds: telemetry.pollingIntervalSeconds,
          }),
        );
        setTrailTruncated(history.truncated);
      } catch (trailLoadError) {
        if (controller.signal.aborted) return;
        setTrail(null);
        setTrailError(
          trailLoadError instanceof Error
            ? trailLoadError.message
            : "Unable to load movement history.",
        );
      } finally {
        if (!controller.signal.aborted) setTrailLoading(false);
      }
    },
    [serverId, telemetry.pollingIntervalSeconds],
  );

  useEffect(() => {
    setTrailEnabled(false);
    setTrail(null);
    setTrailError(null);
    trailRequest.current?.abort();
  }, [serverId, selectedId]);

  useEffect(() => {
    if (trailEnabled && selectedId) {
      void loadTrail(selectedId, trailRange);
    }
    return () => trailRequest.current?.abort();
  }, [loadTrail, selectedId, trailEnabled, trailRange]);
  const applyFitMap = useCallback(() => {
    const fit = fitMapView();
    setZoom(fit.zoom);
    setPan(fit.pan);
  }, []);
  const changeZoom = (next: number) => {
    const nextZoom = clampMapZoom(next);
    setZoom(nextZoom);
    setPan((current) =>
      nextZoom === 1
        ? { x: 0, y: 0 }
        : constrainMapPan(current, viewportSize, surfaceSize, nextZoom),
    );
  };
  const centerSelectedPlayer = () => {
    if (!selected) return;
    const view = centerMapOnPosition(
      selected.position,
      viewportSize,
      surfaceSize,
    );
    setZoom(view.zoom);
    setPan(view.pan);
    setFocusedPlayerId(selected.userId);
    window.setTimeout(() => setFocusedPlayerId(null), 1_200);
  };

  useEffect(() => {
    applyFitMap();
  }, [applyFitMap, expanded]);

  useEffect(() => {
    const element = viewport.current;
    if (!element || surfaceSize === 0) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const bounds = element.getBoundingClientRect();
      const view = zoomMapAtPointer({
        view: { zoom, pan },
        nextZoom: zoom * Math.exp(-event.deltaY * 0.0015),
        pointer: {
          x: event.clientX - (bounds.left + bounds.width / 2),
          y: event.clientY - (bounds.top + bounds.height / 2),
        },
        viewport: viewportSize,
        surfaceSize,
      });
      setZoom(view.zoom);
      setPan(view.pan);
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [pan, surfaceSize, viewportSize, zoom]);

  useEffect(() => {
    const update = () => {
      const viewportElement = viewport.current;
      const surfaceElement = surface.current;
      if (!viewportElement || !surfaceElement) return;
      const markerElement = selected
        ? (Array.from(
            surfaceElement.querySelectorAll<HTMLElement>("[data-player-id]"),
          ).find((element) => element.dataset.playerId === selected.userId) ??
          null)
        : null;
      const viewportRect = viewportElement.getBoundingClientRect();
      const viewportStyle = window.getComputedStyle(viewportElement);
      const surfaceRect = surfaceElement.getBoundingClientRect();
      const imageRect =
        surfaceElement
          .querySelector<HTMLImageElement>(".pc-world-map-image")
          ?.getBoundingClientRect() ?? null;
      const markerRect = markerElement?.getBoundingClientRect() ?? null;
      setDiagnostics({
        viewport: viewportRect,
        surface: surfaceRect,
        image: imageRect,
        marker: markerRect,
        untransformedSurface: {
          width: surfaceElement.offsetWidth,
          height: surfaceElement.offsetHeight,
        },
        markerPlane: {
          width: surfaceElement.offsetWidth,
          height: surfaceElement.offsetHeight,
        },
        viewportClient: {
          width: viewportElement.clientWidth,
          height: viewportElement.clientHeight,
        },
        viewportCss: {
          width: viewportStyle.width,
          height: viewportStyle.height,
          minHeight: viewportStyle.minHeight,
          maxHeight: viewportStyle.maxHeight,
          aspectRatio: viewportStyle.aspectRatio,
        },
        expanded,
        visible: markerRect
          ? rectanglesIntersect(markerRect, viewportRect)
          : false,
      });
    };
    const frame = window.requestAnimationFrame(update);
    return () => window.cancelAnimationFrame(frame);
  }, [expanded, mapLayer, pan, selected, surfaceSize, zoom]);

  const copyCalibration = async (marker: LivePlayerMapMarker) => {
    try {
      await navigator.clipboard.writeText(calibrationRecord(marker));
      notifications.show({
        color: "green",
        title: "Calibration point copied",
        message: "The world and normalized coordinates are on your clipboard.",
      });
    } catch {
      notifications.show({
        color: "red",
        title: "Copy failed",
        message: "Your browser did not allow clipboard access.",
      });
    }
  };

  const copyDiagnostics = async () => {
    if (!selected || !diagnostics) return;
    const rect = (value: MapRect | null) =>
      value
        ? {
            left: Math.round(value.left),
            top: Math.round(value.top),
            right: Math.round(value.right),
            bottom: Math.round(value.bottom),
          }
        : null;
    const output = {
      viewport: {
        width: Math.round(
          diagnostics.viewport.right - diagnostics.viewport.left,
        ),
        height: Math.round(
          diagnostics.viewport.bottom - diagnostics.viewport.top,
        ),
      },
      viewportCss: diagnostics.viewportCss,
      viewportClient: diagnostics.viewportClient,
      expanded: diagnostics.expanded,
      untransformedSurface: diagnostics.untransformedSurface,
      transformedSurface: rect(diagnostics.surface),
      image: rect(diagnostics.image),
      markerPlane: diagnostics.markerPlane,
      zoom,
      pan,
      player: {
        normalized: selected.position,
        renderedPercent: {
          x: Number((selected.position.x * 100).toFixed(2)),
          y: Number((selected.position.y * 100).toFixed(2)),
        },
        screenRect: rect(diagnostics.marker),
        intersectsViewport: diagnostics.visible,
      },
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(output, null, 2));
      notifications.show({
        color: "green",
        message: "Safe map diagnostics copied.",
      });
    } catch {
      notifications.show({
        color: "red",
        message: "Your browser did not allow clipboard access.",
      });
    }
  };

  return (
    <Stack gap="lg" pt="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2}>World Map</Title>
          <Text c="dimmed">
            Current connected players with recent position telemetry.
          </Text>
        </div>
        <Group gap="sm">
          {canCalibrate && (
            <Select
              label="Map layer"
              aria-label="Map layer"
              value={mapLayer}
              onChange={(value) =>
                setMapLayer((value as WorldMapLayer | null) ?? "map")
              }
              allowDeselect={false}
              w={190}
              data={[
                { value: "map", label: "Palpagos map" },
                { value: "grid", label: "Calibration grid" },
                { value: "map-with-grid", label: "Map with grid overlay" },
              ]}
            />
          )}
          {canCalibrate && (
            <Switch
              label="Calibration"
              checked={calibrating}
              onChange={(event) => setCalibrating(event.currentTarget.checked)}
            />
          )}
          <Button
            variant="light"
            onClick={() => loadMap(true)}
            loading={refreshing}
            disabled={loading || !serverOnline}
          >
            Refresh
          </Button>
        </Group>
      </Group>

      {displayedContentState === "offline" && (
        <Alert color="gray" title="Server offline">
          Live player positions are unavailable until the server reconnects.
        </Alert>
      )}
      {error && <Alert color="red">{error}</Alert>}

      {displayedContentState === "loading" ? (
        <Center mih={360}>
          <Loader />
        </Center>
      ) : displayedContentState === "unavailable" ? (
        <Card withBorder radius="md" padding="xl" className="pc-panel">
          <Center mih={220}>
            <Stack align="center" gap="xs">
              <Title order={3}>Map unavailable</Title>
              <Text c="dimmed" ta="center">
                PalCenter could not verify the current connected players.
              </Text>
            </Stack>
          </Center>
        </Card>
      ) : displayedContentState === "empty" ? (
        <Card withBorder radius="md" padding="xl" className="pc-panel">
          <Center mih={220}>
            <Stack align="center" gap="xs">
              <Title order={3}>No players online</Title>
              <Text c="dimmed">Live player markers will appear here.</Text>
            </Stack>
          </Center>
        </Card>
      ) : displayedContentState === "ready" ? (
        <div
          className={`pc-world-map-layout${expanded ? " pc-world-map-expanded" : ""}`}
          role={expanded ? "dialog" : undefined}
          aria-modal={expanded ? true : undefined}
          aria-label={
            expanded ? "Expanded Palpagos live player map" : undefined
          }
        >
          <Card
            withBorder
            radius="md"
            padding="sm"
            className="pc-panel pc-world-map-card"
          >
            <Group justify="space-between" mb="sm">
              <Group gap="xs">
                <Badge color="cyan" variant="light">
                  {model.markers.length} mapped
                </Badge>
                {model.unmappedPlayers.length > 0 && (
                  <Badge color="orange" variant="light">
                    {model.unmappedPlayers.length} unavailable
                  </Badge>
                )}
              </Group>
              <Group gap={4}>
                <Button
                  size="compact-xs"
                  variant="subtle"
                  onClick={applyFitMap}
                >
                  Fit Map
                </Button>
                <Button
                  size="compact-xs"
                  variant="subtle"
                  onClick={centerSelectedPlayer}
                  disabled={!selected}
                >
                  Center Player
                </Button>
                <ActionIcon
                  variant="subtle"
                  aria-label="Zoom out"
                  onClick={() => changeZoom(zoom - 0.5)}
                  disabled={zoom <= 1}
                >
                  <IconMinus size={18} />
                </ActionIcon>
                <ActionIcon
                  variant="subtle"
                  aria-label="Reset map view to fit map"
                  onClick={applyFitMap}
                >
                  <IconFocusCentered size={18} />
                </ActionIcon>
                <ActionIcon
                  variant="subtle"
                  aria-label="Zoom in"
                  onClick={() => changeZoom(zoom + 0.5)}
                  disabled={zoom >= 4}
                >
                  <IconPlus size={18} />
                </ActionIcon>
                <ActionIcon
                  variant="subtle"
                  aria-label={expanded ? "Close expanded map" : "Expand map"}
                  onClick={() => setExpanded((current) => !current)}
                >
                  <IconArrowsMaximize size={18} />
                </ActionIcon>
              </Group>
            </Group>

            <div
              ref={viewport}
              className="pc-world-map-viewport"
              role="region"
              aria-label="Palpagos live player map"
              onPointerDown={(event) => {
                if (
                  zoom <= 1 ||
                  event.button !== 0 ||
                  (event.target as HTMLElement).closest(
                    "button, [data-map-control]",
                  )
                )
                  return;
                event.currentTarget.setPointerCapture(event.pointerId);
                drag.current = {
                  pointerId: event.pointerId,
                  x: event.clientX,
                  y: event.clientY,
                  pan,
                };
              }}
              onPointerMove={(event) => {
                if (!drag.current || drag.current.pointerId !== event.pointerId)
                  return;
                setPan(
                  constrainMapPan(
                    {
                      x: drag.current.pan.x + event.clientX - drag.current.x,
                      y: drag.current.pan.y + event.clientY - drag.current.y,
                    },
                    viewportSize,
                    surfaceSize,
                    zoom,
                  ),
                );
              }}
              onPointerUp={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }
                drag.current = null;
              }}
              onPointerCancel={() => {
                drag.current = null;
              }}
            >
              <div
                ref={surface}
                className={worldMapLayerClasses(mapLayer)}
                style={{
                  width: surfaceSize,
                  height: surfaceSize,
                  transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`,
                }}
              >
                {mapLayer !== "grid" && (
                  <picture>
                    <source
                      type="image/webp"
                      srcSet={worldMapAssetSrcSet}
                      sizes="(max-width: 62em) calc(100vw - 3rem), min(50vw, 760px)"
                    />
                    {/* These pre-generated responsive assets intentionally bypass Next's image optimizer. */}
                    <img
                      className="pc-world-map-image"
                      src={worldMapAssetPath}
                      srcSet={worldMapAssetSrcSet}
                      sizes="(max-width: 62em) calc(100vw - 3rem), min(50vw, 760px)"
                      width={2048}
                      height={2048}
                      alt=""
                      draggable={false}
                    />
                  </picture>
                )}
                {mapLayer !== "map" && (
                  <>
                    <div className="pc-world-map-grid" aria-hidden="true" />
                    <div className="pc-world-map-label">
                      PALPAGOS CALIBRATION GRID
                    </div>
                  </>
                )}
                {trailEnabled && trail && (
                  <svg
                    className="pc-world-map-trail"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    aria-label={`Movement trail for ${selectedPlayerName ?? "selected player"}`}
                    role="img"
                  >
                    {renderedTrailSegments.map((segment, index) => (
                      <line
                        key={`${segment.end.capturedAt}-${index}`}
                        className="pc-world-map-trail-segment"
                        x1={segment.start.x * 100}
                        y1={segment.start.y * 100}
                        x2={segment.end.x * 100}
                        y2={segment.end.y * 100}
                        vectorEffect="non-scaling-stroke"
                        stroke={selectedPlayerColor}
                        opacity={segment.style.opacity}
                        strokeWidth={segment.style.strokeWidth}
                        style={{
                          filter: `brightness(${segment.style.brightness}) drop-shadow(0 0 2px rgba(6, 16, 25, 0.95))`,
                        }}
                      />
                    ))}
                    {trail.segments[0]?.[0] && (
                      <circle
                        className="pc-world-map-trail-start"
                        cx={trail.segments[0][0].x * 100}
                        cy={trail.segments[0][0].y * 100}
                        r="0.7"
                        vectorEffect="non-scaling-stroke"
                        style={{ fill: selectedPlayerColor }}
                      >
                        <title>Trail start</title>
                      </circle>
                    )}
                    {trail.segments.at(-1)?.at(-1) && (
                      <circle
                        className="pc-world-map-trail-end"
                        cx={trail.segments.at(-1)!.at(-1)!.x * 100}
                        cy={trail.segments.at(-1)!.at(-1)!.y * 100}
                        r="0.7"
                        vectorEffect="non-scaling-stroke"
                        style={{ fill: selectedPlayerColor }}
                      >
                        <title>Trail end</title>
                      </circle>
                    )}
                  </svg>
                )}
                {model.markers.map((marker) => {
                  const presentation = playerMarkerPresentation(
                    marker.playerName,
                  );
                  return (
                    <div
                      key={marker.userId}
                      className="pc-world-map-marker-position"
                      style={{
                        left: `${marker.position.x * 100}%`,
                        top: `${marker.position.y * 100}%`,
                      }}
                    >
                      <div
                        className="pc-world-map-marker-visual"
                        style={{
                          transform: `scale(${markerInverseScale(zoom)})`,
                        }}
                      >
                        <button
                          type="button"
                          data-player-id={marker.userId}
                          className={`pc-world-map-marker pc-world-map-marker-${marker.freshness}${focusedPlayerId === marker.userId ? " pc-world-map-marker-focused" : ""}`}
                          style={{
                            backgroundColor: playerColor(marker.userId),
                          }}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedId(marker.userId);
                          }}
                          aria-label={presentation.accessibleName}
                          aria-pressed={selected?.userId === marker.userId}
                        >
                          <span aria-hidden="true">{presentation.initial}</span>
                        </button>
                        <span
                          className="pc-world-map-marker-label"
                          aria-hidden="true"
                        >
                          {presentation.displayName}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <Text size="xs" c="dimmed" mt="xs">
              Scroll to zoom. Drag while zoomed to pan. Use marker buttons for
              player details.
            </Text>
            <Text size="xs" c="dimmed" mt="xs">
              Palworld and the Palpagos map are copyright Pocketpair, Inc.
              PalCenter is an unofficial community project.
            </Text>
          </Card>

          <Stack gap="md" className="pc-world-map-details">
            {selected && diagnostics && !diagnostics.visible && (
              <Alert color="orange">
                <Group justify="space-between">
                  <Text size="sm">
                    {selected.playerName} is mapped but outside the current
                    view.
                  </Text>
                  <Button size="compact-xs" onClick={centerSelectedPlayer}>
                    Center Player
                  </Button>
                </Group>
              </Alert>
            )}
            <PlayerMapDetails
              marker={selected}
              onCopy={canCalibrate && calibrating ? copyCalibration : undefined}
            />
            <TrailControls
              players={telemetry.players.map((snapshot) => ({
                value: snapshot.userId,
                label: snapshot.playerName || snapshot.userId,
              }))}
              selectedPlayerId={selectedId}
              selectedPlayerName={selectedPlayerName}
              enabled={trailEnabled}
              range={trailRange}
              trail={trail}
              playerColor={selectedPlayerColor}
              renderedSegmentCount={renderedTrailSegments.length}
              loading={trailLoading}
              error={trailError}
              truncated={trailTruncated}
              currentlyOnline={selected !== null}
              onPlayerChange={setSelectedId}
              onEnabledChange={setTrailEnabled}
              onRangeChange={setTrailRange}
              onRefresh={() => {
                if (selectedId) void loadTrail(selectedId, trailRange);
              }}
              onClear={() => {
                trailRequest.current?.abort();
                setTrailEnabled(false);
                setTrail(null);
                setTrailError(null);
              }}
            />
            {canCalibrate && calibrating && (
              <CalibrationPanel
                unmapped={model.unmappedPlayers}
                pollingIntervalSeconds={telemetry.pollingIntervalSeconds}
                viewportSize={viewportSize}
                zoom={zoom}
                pan={pan}
                diagnostics={diagnostics}
                onCopyDiagnostics={copyDiagnostics}
              />
            )}
          </Stack>
        </div>
      ) : null}
    </Stack>
  );
}

function TrailControls({
  players,
  selectedPlayerId,
  selectedPlayerName,
  enabled,
  range,
  trail,
  playerColor,
  renderedSegmentCount,
  loading,
  error,
  truncated,
  currentlyOnline,
  onPlayerChange,
  onEnabledChange,
  onRangeChange,
  onRefresh,
  onClear,
}: {
  players: Array<{ value: string; label: string }>;
  selectedPlayerId: string | null;
  selectedPlayerName: string | null;
  enabled: boolean;
  range: TrailRange;
  trail: ProcessedTrail | null;
  playerColor: string;
  renderedSegmentCount: number;
  loading: boolean;
  error: string | null;
  truncated: boolean;
  currentlyOnline: boolean;
  onPlayerChange: (userId: string | null) => void;
  onEnabledChange: (enabled: boolean) => void;
  onRangeChange: (range: TrailRange) => void;
  onRefresh: () => void;
  onClear: () => void;
}) {
  const formatTimestamp = (value: string | null) =>
    value ? new Date(value).toLocaleString() : "—";

  return (
    <Card withBorder radius="md" padding="lg" className="pc-panel">
      <Stack gap="sm">
        <Group justify="space-between">
          <div>
            <Title order={4}>Movement trail</Title>
            <Text size="sm" c="dimmed">
              {selectedPlayerName
                ? `Historical positions for ${selectedPlayerName}.`
                : "Select a player to view movement history."}
            </Text>
          </div>
          <Switch
            label="Show movement trail"
            checked={enabled}
            disabled={!selectedPlayerName}
            onChange={(event) => onEnabledChange(event.currentTarget.checked)}
          />
        </Group>
        <Select
          label="Trail player"
          description="Choose a connected or recently observed player."
          placeholder="Select a player"
          searchable
          clearable
          value={selectedPlayerId}
          data={players}
          onChange={onPlayerChange}
        />
        <SegmentedControl
          aria-label="Movement trail time range"
          value={range}
          disabled={!selectedPlayerName}
          onChange={(value) => onRangeChange(value as TrailRange)}
          data={["15m", "1h", "6h", "24h"]}
          fullWidth
        />
        <Group grow>
          <Button
            variant="light"
            loading={loading}
            disabled={!selectedPlayerName || !enabled}
            onClick={onRefresh}
          >
            Refresh trail
          </Button>
          <Button
            variant="default"
            disabled={!enabled && !trail}
            onClick={onClear}
          >
            Clear trail
          </Button>
        </Group>
        {error && <Alert color="red">{error}</Alert>}
        {enabled && loading && (
          <Text size="sm" c="dimmed" role="status">
            Loading movement history…
          </Text>
        )}
        {enabled && !loading && !error && trail?.pointCount === 0 && (
          <Alert color="gray">
            No valid position history was captured in this time range.
          </Alert>
        )}
        {enabled && trail && trail.pointCount > 0 && (
          <Stack gap={4} role="status" aria-label="Movement trail summary">
            <div
              className="pc-world-map-trail-legend"
              aria-label="Trail age: faint is older and bright is newer"
              style={
                {
                  "--pc-player-color": playerColor,
                } as CSSProperties
              }
            >
              <Text size="xs">Older</Text>
              <span aria-hidden="true" />
              <Text size="xs">Newer</Text>
            </div>
            <SimpleGrid cols={2}>
              <Detail
                label="First position"
                value={formatTimestamp(trail.firstTimestamp)}
              />
              <Detail
                label="Last position"
                value={formatTimestamp(trail.lastTimestamp)}
              />
              <Detail label="Trail points" value={String(trail.pointCount)} />
              <Detail
                label="Path segments"
                value={String(trail.segments.length)}
              />
              <Detail
                label="Rendered segments"
                value={String(renderedSegmentCount)}
              />
              <Detail
                label="Approx. distance"
                value={`${Math.round(trail.approximateDistance).toLocaleString()} world units`}
              />
              <Detail
                label="Player status"
                value={currentlyOnline ? "Currently online" : "Not online"}
              />
              <Detail
                label="Invalid points excluded"
                value={String(trail.exclusions.invalid)}
              />
              <Detail
                label="Discontinuities"
                value={String(
                  trail.exclusions.timeGap + trail.exclusions.teleport,
                )}
              />
            </SimpleGrid>
            {truncated && (
              <Alert color="orange">
                Showing the newest 5,000 captured positions in this range.
              </Alert>
            )}
          </Stack>
        )}
      </Stack>
    </Card>
  );
}

function PlayerMapDetails({
  marker,
  onCopy,
}: {
  marker: LivePlayerMapMarker | null;
  onCopy?: (marker: LivePlayerMapMarker) => void;
}) {
  const details = marker ? playerMapDetailValues(marker) : null;

  return (
    <Card withBorder radius="md" padding="lg" className="pc-panel">
      {!marker ? (
        <Center mih={220}>
          <Stack align="center" gap="xs">
            <Title order={3}>Select a player</Title>
            <Text c="dimmed" ta="center">
              Choose a marker to inspect its current position and telemetry.
            </Text>
          </Stack>
        </Center>
      ) : details ? (
        <Stack gap="md">
          <Group justify="space-between">
            <div>
              <Title order={3}>{details.playerName}</Title>
              <Text c="dimmed">{details.accountName}</Text>
            </div>
            <Badge
              color={
                marker.freshness === "live"
                  ? "green"
                  : marker.freshness === "delayed"
                    ? "orange"
                    : "red"
              }
            >
              {telemetryFreshnessLabel(marker.freshness)}
            </Badge>
          </Group>
          {marker.freshness === "stale" && (
            <Alert color="red">
              This position is more than five minutes old.
            </Alert>
          )}
          <SimpleGrid cols={2}>
            <Detail label="Level" value={details.level} />
            <Detail label="Ping" value={details.ping} />
            <Detail label="Structures" value={details.buildingCount} />
            <Detail label="Updated" value={details.telemetryAge} />
          </SimpleGrid>
          <Detail label="Player ID" value={details.playerId} mono />
          <Detail label="User ID" value={details.userId} mono />
          <Detail
            label="World coordinates"
            value={details.worldCoordinates}
            mono
          />
          {onCopy && (
            <>
              <Detail
                label="Normalized coordinates"
                value={`${marker.position.x.toFixed(4)}, ${marker.position.y.toFixed(4)}`}
                mono
              />
              <Detail
                label="Rendered position"
                value={`${(marker.position.x * 100).toFixed(2)}%, ${(marker.position.y * 100).toFixed(2)}%`}
                mono
              />
            </>
          )}
          {onCopy && (
            <Button
              variant="light"
              leftSection={<IconCopy size={16} />}
              onClick={() => onCopy(marker)}
            >
              Copy calibration point
            </Button>
          )}
        </Stack>
      ) : null}
    </Card>
  );
}

function Detail({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | number;
  mono?: boolean;
}) {
  return (
    <div>
      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
        {label}
      </Text>
      <Text size="sm" ff={mono ? "monospace" : undefined} lineClamp={2}>
        {value}
      </Text>
    </div>
  );
}

function CalibrationPanel({
  unmapped,
  pollingIntervalSeconds,
  viewportSize,
  zoom,
  pan,
  diagnostics,
  onCopyDiagnostics,
}: {
  unmapped: ReturnType<typeof buildLivePlayerMapModel>["unmappedPlayers"];
  pollingIntervalSeconds: number;
  viewportSize: { width: number; height: number };
  zoom: number;
  pan: MapPan;
  diagnostics: {
    viewport: MapRect;
    surface: MapRect;
    image: MapRect | null;
    marker: MapRect | null;
    untransformedSurface: { width: number; height: number };
    markerPlane: { width: number; height: number };
    viewportClient: { width: number; height: number };
    viewportCss: {
      width: string;
      height: string;
      minHeight: string;
      maxHeight: string;
      aspectRatio: string;
    };
    expanded: boolean;
    visible: boolean;
  } | null;
  onCopyDiagnostics: () => void;
}) {
  return (
    <Paper withBorder radius="md" p="lg">
      <Stack gap="sm">
        <Title order={4}>Projection calibration</Title>
        <Text size="sm" c="dimmed">
          Administrator-only diagnostics for validating the prototype
          projection. No player IP addresses are included.
        </Text>
        <Code block>
          {`X: ${palpagosProjection.worldMinX} … ${palpagosProjection.worldMaxX}
Y: ${palpagosProjection.worldMinY} … ${palpagosProjection.worldMaxY}
Rotation: ${palpagosProjection.rotationDegrees}°
Polling interval: ${pollingIntervalSeconds}s
Viewport: ${viewportSize.width} × ${viewportSize.height}px
Viewport CSS: ${diagnostics?.viewportCss.width ?? "0px"} × ${diagnostics?.viewportCss.height ?? "0px"}
Viewport min/max: ${diagnostics?.viewportCss.minHeight ?? "0px"} / ${diagnostics?.viewportCss.maxHeight ?? "none"}
Viewport aspect-ratio: ${diagnostics?.viewportCss.aspectRatio ?? "auto"}
Viewport client: ${diagnostics?.viewportClient.width ?? 0} × ${diagnostics?.viewportClient.height ?? 0}px
Surface (untransformed): ${diagnostics?.untransformedSurface.width ?? 0} × ${diagnostics?.untransformedSurface.height ?? 0}px
Surface (transformed): ${diagnostics ? Math.round(diagnostics.surface.right - diagnostics.surface.left) : 0} × ${diagnostics ? Math.round(diagnostics.surface.bottom - diagnostics.surface.top) : 0}px
Image: ${diagnostics?.image ? `${Math.round(diagnostics.image.right - diagnostics.image.left)} × ${Math.round(diagnostics.image.bottom - diagnostics.image.top)}px` : "not rendered"}
Marker plane: ${diagnostics?.markerPlane.width ?? 0} × ${diagnostics?.markerPlane.height ?? 0}px
Scale: ${zoom.toFixed(2)}×
Offset: ${Math.round(pan.x)}px, ${Math.round(pan.y)}px
Expanded: ${diagnostics?.expanded ? "yes" : "no"}`}
        </Code>
        <Button
          variant="light"
          leftSection={<IconCopy size={16} />}
          onClick={onCopyDiagnostics}
          disabled={!diagnostics?.marker}
        >
          Copy safe diagnostics
        </Button>
        {unmapped.length > 0 && (
          <Stack gap={4}>
            <Text size="sm" fw={700}>
              Unmapped connected players
            </Text>
            {unmapped.map((player) => (
              <Text key={player.userId} size="xs" c="dimmed">
                {player.playerName}: {player.reason.replaceAll("_", " ")}
              </Text>
            ))}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
