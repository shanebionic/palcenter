"use client";

import {
  Alert,
  Badge,
  Button,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from "@mantine/core";
import {
  IconCalendarEvent,
  IconMapPin,
  IconRefresh,
  IconTimeline,
} from "@tabler/icons-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { getCompanionStatus, getWorldEvents } from "../lib/api";
import {
  exactWorldEventTime,
  mergeWorldEventPages,
  relativeWorldEventTime,
  sortWorldEventsNewestFirst,
  worldEventConfidence,
  worldEventCoordinateSpace,
  worldEventEvidenceText,
  worldEventLabels,
  worldEventMetadataText,
  worldEventPlayerName,
  worldEventPositionSupportsPalpagosMap,
  worldEventRelocationPosition,
  worldEventSentence,
  worldEventTimeRangeFromNow,
} from "../lib/world-events";
import {
  worldEventTypes,
  type WorldEvent,
  type WorldEventType,
} from "../types/servers";
import type { CompanionStatus } from "../types/companion";
import { BrandedLoader } from "./BrandedLoader";
import { SectionCard } from "./ui/SectionCard";
import { SectionHeader } from "./ui/SectionHeader";

interface ServerWorldEventsProps {
  serverId: string;
  serverOnline: boolean;
  onViewOnMap: (event: WorldEvent) => void;
}

type TimeRange = "1h" | "6h" | "24h" | "7d" | "all";
const pageSize = 50;

const eventTypeOptions = worldEventTypes.map((value) => ({
  value,
  label: worldEventLabels[value],
}));

export function ServerWorldEvents({
  serverId,
  serverOnline,
  onViewOnMap,
}: ServerWorldEventsProps) {
  const [events, setEvents] = useState<WorldEvent[]>([]);
  const [playerFilter, setPlayerFilter] = useState("");
  const [eventType, setEventType] = useState<WorldEventType | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>("24h");
  const [applied, setApplied] = useState({
    playerId: "",
    eventType: null as WorldEventType | null,
    timeRange: "24h" as TimeRange,
  });
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [companionStatus, setCompanionStatus] =
    useState<CompanionStatus | null>(null);

  const load = useCallback(
    async (older = false) => {
      if (older) {
        setLoadingOlder(true);
      } else {
        setLoading(true);
      }
      setError(false);
      const oldest = older ? events.at(-1)?.timestamp : undefined;
      try {
        const next = await getWorldEvents(serverId, {
          userId: applied.playerId || undefined,
          type: applied.eventType ?? undefined,
          from: worldEventTimeRangeFromNow(applied.timeRange),
          to: oldest,
          limit: pageSize,
        });
        setEvents((current) =>
          older
            ? mergeWorldEventPages(current, next)
            : sortWorldEventsNewestFirst(next),
        );
        setHasOlder(next.length === pageSize);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
        setLoadingOlder(false);
      }
    },
    [applied, events, serverId],
  );

  useEffect(() => {
    void load();
    // Reload only when the applied server-side filters change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied, serverId]);

  useEffect(() => {
    void getCompanionStatus(serverId)
      .then(setCompanionStatus)
      .catch(() => setCompanionStatus(null));
  }, [serverId]);

  const exactActivityAvailable =
    companionStatus?.state === "connected" &&
    companionStatus.capabilities.playerActivity?.supported === true;

  const filtersActive = Boolean(
    applied.playerId || applied.eventType || applied.timeRange !== "24h",
  );

  const applyFilters = () =>
    setApplied({
      playerId: playerFilter.trim(),
      eventType,
      timeRange,
    });
  const resetFilters = () => {
    setPlayerFilter("");
    setEventType(null);
    setTimeRange("24h");
    setApplied({ playerId: "", eventType: null, timeRange: "24h" });
  };

  return (
    <Stack gap="lg" pt="lg">
      <SectionHeader
        title="Player Activity"
        description="See when players join, leave, disconnect, and return."
        action={
          <Button
            variant="light"
            leftSection={<IconRefresh size={16} />}
            onClick={() => void load()}
            disabled={loading}
          >
            Refresh
          </Button>
        }
      />

      {!serverOnline && (
        <Alert color="yellow" title="Server offline">
          Existing activity remains available. New activity will resume when
          PalCenter can observe the server again.
        </Alert>
      )}

      {companionStatus && !exactActivityAvailable && (
        <Alert
          color={
            companionStatus.state === "authentication_failed" ? "red" : "blue"
          }
          title={
            companionStatus.state === "authentication_failed"
              ? "Companion authentication failed"
              : "Using standard server information"
          }
        >
          {companionStatus.state === "authentication_failed"
            ? "Check the Companion API token in Connection Settings."
            : "PalCenter will show inferred player activity until a compatible Companion reconnects."}
        </Alert>
      )}

      <SectionCard>
        <Stack gap="md">
          <Title order={3}>Filter activity</Title>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
            <TextInput
              label="Player ID"
              description="Use the stable user ID shown in event details."
              placeholder="All players"
              value={playerFilter}
              onChange={(event) => setPlayerFilter(event.currentTarget.value)}
            />
            <Select
              label="Activity type"
              placeholder="All activity"
              clearable
              searchable
              data={eventTypeOptions}
              value={eventType}
              onChange={(value) => setEventType(value as WorldEventType | null)}
            />
            <Select
              label="Time range"
              data={[
                { value: "1h", label: "Last hour" },
                { value: "6h", label: "Last 6 hours" },
                { value: "24h", label: "Last 24 hours" },
                { value: "7d", label: "Last 7 days" },
                { value: "all", label: "All retained history" },
              ]}
              value={timeRange}
              onChange={(value) => setTimeRange((value ?? "24h") as TimeRange)}
            />
          </SimpleGrid>
          <Group>
            <Button onClick={applyFilters}>Apply filters</Button>
            <Button variant="subtle" onClick={resetFilters}>
              Reset filters
            </Button>
          </Group>
        </Stack>
      </SectionCard>

      {loading ? (
        <SectionCard>
          <BrandedLoader message="Loading player activity" />
        </SectionCard>
      ) : error ? (
        <SectionCard>
          <Alert color="red" title="Player activity is temporarily unavailable">
            PalCenter could not load recent activity. Check the server
            connection and try again. Existing history has not been changed.
          </Alert>
        </SectionCard>
      ) : events.length === 0 ? (
        <SectionCard>
          <Stack align="center" ta="center" py="xl">
            <ThemeIcon size={48} radius="xl" variant="light">
              <IconTimeline size={26} />
            </ThemeIcon>
            <Title order={3}>
              {filtersActive
                ? "No activity matches these filters"
                : "No activity yet"}
            </Title>
            <Text c="dimmed" maw={560}>
              {filtersActive
                ? "Adjust or reset the filters to view other recent activity."
                : "Player activity will appear here after someone joins or leaves the server."}
            </Text>
            {filtersActive && (
              <Button variant="light" onClick={resetFilters}>
                Reset filters
              </Button>
            )}
          </Stack>
        </SectionCard>
      ) : (
        <SectionCard>
          <Stack gap="md">
            <Title order={3}>Recent Activity</Title>
            <ol
              className="pc-world-event-timeline"
              aria-label="Player activity timeline"
            >
              {events.map((event) => (
                <WorldEventEntry
                  key={event.id}
                  event={event}
                  onViewOnMap={onViewOnMap}
                />
              ))}
            </ol>
            {hasOlder && (
              <Button
                variant="light"
                onClick={() => void load(true)}
                loading={loadingOlder}
                mx="auto"
              >
                Load older activity
              </Button>
            )}
          </Stack>
        </SectionCard>
      )}
    </Stack>
  );
}

const WorldEventEntry = memo(function WorldEventEntry({
  event,
  onViewOnMap,
}: {
  event: WorldEvent;
  onViewOnMap: (event: WorldEvent) => void;
}) {
  const confidence = worldEventConfidence(event.confidence);
  const playerName = worldEventPlayerName(event);
  const origin = worldEventRelocationPosition(event, "origin");
  const destination = worldEventRelocationPosition(event, "destination");
  const originSpace = worldEventCoordinateSpace(event, "origin");
  const destinationSpace = worldEventCoordinateSpace(event, "destination");
  const originMapSupported = worldEventPositionSupportsPalpagosMap(
    event,
    "origin",
  );
  const destinationMapSupported = worldEventPositionSupportsPalpagosMap(
    event,
    "destination",
  );
  const metadata = useMemo(
    () =>
      Object.entries(event.metadata).filter(
        ([key]) =>
          key !== "playerName" &&
          key !== "matchedTransitionSignatureId" &&
          !["originX", "originY", "destinationX", "destinationY"].includes(key),
      ),
    [event.metadata],
  );

  return (
    <li className="pc-world-event-entry">
      <Group align="flex-start" wrap="nowrap">
        <ThemeIcon
          variant="light"
          radius="xl"
          aria-hidden="true"
          className="pc-world-event-icon"
        >
          <IconCalendarEvent size={18} />
        </ThemeIcon>
        <Stack gap="xs" className="pc-world-event-content">
          <Group justify="space-between" align="flex-start">
            <div>
              <Title order={4}>{worldEventSentence(event)}</Title>
              <Text size="sm">
                <Text span fw={600}>
                  {playerName}
                </Text>{" "}
                ·{" "}
                {event.type.startsWith("session_")
                  ? "Online session"
                  : "Player activity"}
              </Text>
            </div>
            <Badge
              color={confidence.color}
              variant="light"
              aria-label={`Confidence: ${confidence.label}`}
            >
              {confidence.label}
            </Badge>
          </Group>
          <Text
            component="time"
            dateTime={event.timestamp}
            title={exactWorldEventTime(event.timestamp)}
            size="sm"
            c="dimmed"
          >
            {relativeWorldEventTime(event.timestamp)}
            {" · "}
            {exactWorldEventTime(event.timestamp)}
          </Text>
          <Group>
            {origin && originMapSupported && (
              <Button
                size="xs"
                variant="light"
                leftSection={<IconMapPin size={14} />}
                onClick={() => onViewOnMap({ ...event, position: origin })}
              >
                View origin on map
              </Button>
            )}
            {destination && destinationMapSupported && (
              <Button
                size="xs"
                variant="light"
                leftSection={<IconMapPin size={14} />}
                onClick={() => onViewOnMap({ ...event, position: destination })}
              >
                View destination on map
              </Button>
            )}
            {event.position && !origin && !destination && (
              <Button
                size="xs"
                variant="light"
                leftSection={<IconMapPin size={14} />}
                onClick={() => onViewOnMap(event)}
              >
                View on map
              </Button>
            )}
          </Group>
          {origin && !originMapSupported && (
            <Text size="xs" c="dimmed">
              Origin map unavailable ({originSpace ?? "unknown"} coordinate
              space).
            </Text>
          )}
          {destination && !destinationMapSupported && (
            <Text size="xs" c="dimmed">
              Destination map unavailable ({destinationSpace ?? "unknown"}{" "}
              coordinate space).
            </Text>
          )}
          <details className="pc-world-event-details">
            <summary>Evidence and details</summary>
            <Stack gap="xs" mt="xs">
              <Text size="sm">
                Confidence: {Math.round(event.confidence * 100)}%
              </Text>
              {event.evidence.map((item, index) => (
                <Text size="sm" key={`${item.fact}-${item.value}-${index}`}>
                  {worldEventEvidenceText(item)}
                </Text>
              ))}
              <Text size="xs" c="dimmed">
                User ID: {event.userId}
              </Text>
              {event.playerId && (
                <Text size="xs" c="dimmed">
                  Player ID: {event.playerId}
                </Text>
              )}
              {event.position && !origin && !destination && (
                <Text size="xs" c="dimmed">
                  Position: X {event.position.x}, Y {event.position.y}
                  {event.position.z === null ? "" : `, Z ${event.position.z}`}
                </Text>
              )}
              {origin && destination && (
                <Text
                  size="xs"
                  c="dimmed"
                  className="pc-world-event-coordinate"
                >
                  Origin: X {origin.x}, Y {origin.y} · Destination: X{" "}
                  {destination.x}, Y {destination.y}
                </Text>
              )}
              {metadata.map(([key, value]) => (
                <Text size="xs" c="dimmed" key={key}>
                  {worldEventMetadataText(key, value)}
                </Text>
              ))}
            </Stack>
          </details>
        </Stack>
      </Group>
    </li>
  );
});
