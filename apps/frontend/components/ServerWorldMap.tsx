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
  IconFocusCentered,
  IconMinus,
  IconPlus,
} from "@tabler/icons-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getPlayers, getPlayerTelemetry } from "../lib/api";
import {
  buildLivePlayerMapModel,
  calibrationRecord,
  mapContentState,
  playerMapDetailValues,
  telemetryFreshnessLabel,
  type LivePlayerMapMarker,
} from "../lib/world-map/model";
import {
  worldMapAssetPath,
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

interface Pan {
  x: number;
  y: number;
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
  const [mapLayer, setMapLayer] = useState<WorldMapLayer>("map");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Pan>({ x: 0, y: 0 });
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const viewport = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{
    pointerId: number;
    x: number;
    y: number;
    pan: Pan;
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
      setViewportSize({
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
      });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [loading, serverOnline]);

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

  const changeZoom = (next: number) => {
    setZoom(Math.min(4, Math.max(1, next)));
    if (next <= 1) setPan({ x: 0, y: 0 });
  };
  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

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
        <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
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
                  aria-label="Reset map view"
                  onClick={resetView}
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
              </Group>
            </Group>

            <div
              ref={viewport}
              className="pc-world-map-viewport"
              role="region"
              aria-label="Palpagos live player map"
              onWheel={(event) => {
                event.preventDefault();
                changeZoom(zoom + (event.deltaY < 0 ? 0.25 : -0.25));
              }}
              onPointerDown={(event) => {
                if (zoom <= 1 || event.button !== 0) return;
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
                setPan({
                  x: drag.current.pan.x + event.clientX - drag.current.x,
                  y: drag.current.pan.y + event.clientY - drag.current.y,
                });
              }}
              onPointerUp={() => {
                drag.current = null;
              }}
            >
              <div
                className={worldMapLayerClasses(mapLayer)}
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                }}
              >
                {mapLayer !== "grid" && (
                  <Image
                    className="pc-world-map-image"
                    src={worldMapAssetPath}
                    alt=""
                    draggable={false}
                    fill
                    sizes="(max-width: 62em) 100vw, 50vw"
                    unoptimized
                  />
                )}
                {mapLayer !== "map" && (
                  <>
                    <div className="pc-world-map-grid" aria-hidden="true" />
                    <div className="pc-world-map-label">
                      PALPAGOS CALIBRATION GRID
                    </div>
                  </>
                )}
                {model.markers.map((marker) => (
                  <button
                    key={marker.userId}
                    type="button"
                    className={`pc-world-map-marker pc-world-map-marker-${marker.freshness}`}
                    style={{
                      left: `${marker.position.x * 100}%`,
                      top: `${marker.position.y * 100}%`,
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedId(marker.userId);
                    }}
                    aria-label={`${marker.playerName}, ${telemetryFreshnessLabel(marker.freshness)} position`}
                    aria-pressed={selected?.userId === marker.userId}
                  >
                    <span>{marker.playerName.slice(0, 1).toUpperCase()}</span>
                    <span className="pc-world-map-marker-label">
                      {marker.playerName}
                    </span>
                  </button>
                ))}
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
}: {
  unmapped: ReturnType<typeof buildLivePlayerMapModel>["unmappedPlayers"];
  pollingIntervalSeconds: number;
  viewportSize: { width: number; height: number };
  zoom: number;
  pan: Pan;
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
Scale: ${zoom.toFixed(2)}×
Offset: ${Math.round(pan.x)}px, ${Math.round(pan.y)}px`}
        </Code>
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
