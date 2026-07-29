"use client";

import {
  Badge,
  Card,
  Divider,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import {
  formatDistance,
  formatDuration,
  formatSpeed,
  type ActivitySummary,
  type OperationalFlag,
} from "../lib/world-map/activity-summary";

export function PlayerActivitySummary({
  summary,
}: {
  summary: ActivitySummary;
}) {
  const statistics = summary.statistics;
  return (
    <Card
      withBorder
      radius="md"
      padding="md"
      className="pc-activity-summary"
      aria-label="Player activity summary"
    >
      <Stack gap="sm">
        <section aria-labelledby="activity-executive-summary">
          <Text
            id="activity-executive-summary"
            fw={700}
            className="pc-activity-executive-summary"
          >
            {summary.executiveSummary}
          </Text>
        </section>

        <Divider />

        <section aria-labelledby="activity-classification">
          <Group justify="space-between" gap="xs">
            <Title id="activity-classification" order={5}>
              Activity classification
            </Title>
            <Badge
              variant="light"
              color={classificationColor(summary.classification)}
            >
              {summary.classification}
            </Badge>
          </Group>
        </section>

        <Divider />

        <section aria-labelledby="activity-flags">
          <Stack gap="xs">
            <Title id="activity-flags" order={5}>
              Operational flags
            </Title>
            {summary.flags.map((flag) => (
              <div key={flag.type} className="pc-activity-flag">
                <Badge
                  size="sm"
                  variant="dot"
                  color={flagColor(flag)}
                  aria-label={`Flag: ${flag.label}`}
                >
                  {flag.label}
                </Badge>
                <Text size="xs" c="dimmed">
                  {flag.detail}
                </Text>
              </div>
            ))}
          </Stack>
        </section>

        <Divider />

        <section aria-labelledby="activity-statistics">
          <Stack gap="xs">
            <Title id="activity-statistics" order={5}>
              Movement statistics
            </Title>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
              <ActivityValue
                label="Time window"
                value={formatDuration(statistics.timeWindowMs)}
              />
              <ActivityValue
                label="Active duration"
                value={formatDuration(statistics.activeDurationMs)}
              />
              <ActivityValue
                label="First activity"
                value={formatTimestamp(statistics.firstActivityAt)}
              />
              <ActivityValue
                label="Last activity"
                value={formatTimestamp(statistics.lastActivityAt)}
              />
              <ActivityValue
                label="Samples collected"
                value={statistics.samplesCollected.toLocaleString()}
              />
              <ActivityValue
                label="Rendered trail segments"
                value={statistics.renderedTrailSegments.toLocaleString()}
              />
              <ActivityValue
                label="Approximate travel distance"
                value={formatDistance(statistics.approximateTravelDistance)}
              />
              <ActivityValue
                label="Average movement speed"
                value={formatSpeed(statistics.averageMovementSpeed)}
              />
              <ActivityValue
                label="Maximum movement speed"
                value={formatSpeed(statistics.maximumMovementSpeed)}
              />
              <ActivityValue
                label="Longest stationary period"
                value={formatDuration(statistics.longestStationaryPeriodMs)}
              />
              <ActivityValue
                label="Disconnected path count"
                value={String(statistics.disconnectedPathCount)}
              />
              <ActivityValue
                label="Teleport or gap count"
                value={String(statistics.teleportOrGapCount)}
              />
              <ActivityValue
                label="Current online status"
                value={statistics.currentlyOnline ? "Online" : "Offline"}
              />
              <ActivityValue
                label="Current position age"
                value={formatDuration(statistics.currentPositionAgeMs)}
              />
              <ActivityValue
                label="Movement percentage"
                value={`${Math.round(statistics.movementPercentage)}%`}
              />
              <ActivityValue
                label="Stationary percentage"
                value={`${Math.round(statistics.stationaryPercentage)}%`}
              />
            </SimpleGrid>
          </Stack>
        </section>

        <Divider />

        <section aria-labelledby="activity-timeline">
          <Stack gap="xs">
            <Title id="activity-timeline" order={5}>
              Timeline
            </Title>
            <Stack gap={4} className="pc-activity-timeline">
              {summary.timeline.map((event, index) => (
                <Group
                  key={`${event.occurredAt}-${event.type}-${index}`}
                  gap="xs"
                  wrap="nowrap"
                >
                  <Text
                    component="time"
                    dateTime={event.occurredAt}
                    size="xs"
                    c="dimmed"
                    className="pc-activity-timeline-time"
                  >
                    {formatTime(event.occurredAt)}
                  </Text>
                  <Text size="sm">{event.label}</Text>
                </Group>
              ))}
            </Stack>
          </Stack>
        </section>

        <Divider />

        <section aria-labelledby="activity-insights">
          <Stack gap={4}>
            <Title id="activity-insights" order={5}>
              Insights
            </Title>
            {summary.insights.map((insight) => (
              <Text key={insight} size="sm">
                {insight}
              </Text>
            ))}
          </Stack>
        </section>
      </Stack>
    </Card>
  );
}

function ActivityValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="pc-activity-value">
      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
        {label}
      </Text>
      <Text size="sm">{value}</Text>
    </div>
  );
}

function classificationColor(
  classification: ActivitySummary["classification"],
): string {
  switch (classification) {
    case "Highly Active":
      return "violet";
    case "Exploring":
      return "cyan";
    case "Mostly Idle":
      return "yellow";
    case "Idle":
      return "gray";
    case "Recently Disconnected":
      return "orange";
    case "Offline":
      return "red";
  }
}

function flagColor(flag: OperationalFlag): string {
  if (flag.severity === "warning") return "orange";
  if (flag.severity === "notice") return "yellow";
  return "gray";
}

function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString();
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}
