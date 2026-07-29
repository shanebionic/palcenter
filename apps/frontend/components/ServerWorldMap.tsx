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
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getPlayers, getPlayerTelemetry } from "../lib/api";
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
  const [diagnostics, setDiagnostics] = useState<{
    viewport: MapRect;
    surface: MapRect;
    image: MapRect | null;
    marker: MapRect | null;
    untransformedSurface: { width: number; height: number };
    markerPlane: { width: number; height: number };
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
          current.width > 0 &&
          (Math.abs(current.width - nextSize.width) > 160 ||
            Math.abs(current.height - nextSize.height) > 160)
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
  const contentState = mapContentState({
    loading,
    serverOnline,
    playerRequestFailed,
    connectedPlayerCount: players.length,
  });

  const surfaceSize = mapSurfaceSize(viewportSize);
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
        visible: markerRect
          ? rectanglesIntersect(markerRect, viewportRect)
          : false,
      });
    };
    const frame = window.requestAnimationFrame(update);
    return () => window.cancelAnimationFrame(frame);
  }, [mapLayer, pan, selected, surfaceSize, zoom]);

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

      {contentState === "offline" && (
        <Alert color="gray" title="Server offline">
          Live player positions are unavailable until the server reconnects.
        </Alert>
      )}
      {error && <Alert color="red">{error}</Alert>}

      {contentState === "loading" ? (
        <Center mih={360}>
          <Loader />
        </Center>
      ) : contentState === "unavailable" ? (
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
      ) : contentState === "empty" ? (
        <Card withBorder radius="md" padding="xl" className="pc-panel">
          <Center mih={220}>
            <Stack align="center" gap="xs">
              <Title order={3}>No players online</Title>
              <Text c="dimmed">Live player markers will appear here.</Text>
            </Stack>
          </Center>
        </Card>
      ) : contentState === "ready" ? (
        <SimpleGrid
          cols={{ base: 1, lg: 2 }}
          spacing="lg"
          className={expanded ? "pc-world-map-expanded" : undefined}
          role={expanded ? "dialog" : undefined}
          aria-modal={expanded ? true : undefined}
          aria-label={
            expanded ? "Expanded Palpagos live player map" : undefined
          }
        >
          <Card withBorder radius="md" padding="sm" className="pc-panel">
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
                {model.markers.map((marker) => {
                  const presentation = playerMarkerPresentation(
                    marker.playerName,
                  );
                  return (
                    <Fragment key={marker.userId}>
                      <button
                        type="button"
                        data-player-id={marker.userId}
                        className={`pc-world-map-marker pc-world-map-marker-${marker.freshness}${focusedPlayerId === marker.userId ? " pc-world-map-marker-focused" : ""}`}
                        style={{
                          left: `${marker.position.x * 100}%`,
                          top: `${marker.position.y * 100}%`,
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
                        style={{
                          left: `${marker.position.x * 100}%`,
                          top: `${marker.position.y * 100}%`,
                        }}
                      >
                        {presentation.displayName}
                      </span>
                    </Fragment>
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

          <Stack gap="md">
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
        </SimpleGrid>
      ) : null}
    </Stack>
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
Surface (untransformed): ${diagnostics?.untransformedSurface.width ?? 0} × ${diagnostics?.untransformedSurface.height ?? 0}px
Surface (transformed): ${diagnostics ? Math.round(diagnostics.surface.right - diagnostics.surface.left) : 0} × ${diagnostics ? Math.round(diagnostics.surface.bottom - diagnostics.surface.top) : 0}px
Image: ${diagnostics?.image ? `${Math.round(diagnostics.image.right - diagnostics.image.left)} × ${Math.round(diagnostics.image.bottom - diagnostics.image.top)}px` : "not rendered"}
Marker plane: ${diagnostics?.markerPlane.width ?? 0} × ${diagnostics?.markerPlane.height ?? 0}px
Scale: ${zoom.toFixed(2)}×
Offset: ${Math.round(pan.x)}px, ${Math.round(pan.y)}px`}
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
