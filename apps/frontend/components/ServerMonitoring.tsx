"use client";

import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  ScrollArea,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { useCallback, useEffect, useState } from "react";
import { getServerEvents, getServerHistory } from "../lib/api";
import type { ServerEvent, ServerMetric } from "../types/servers";

interface ServerMonitoringProps {
  serverId: string;
}

function dateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function known(value: number | null, suffix = ""): string {
  return value === null ? "—" : `${value}${suffix}`;
}

function eventLabel(event: ServerEvent): string {
  switch (event.type) {
    case "server_online":
      return "Server came online";
    case "server_offline":
      return "Server went offline";
    case "server_restarted":
      return "Server restarted";
    case "player_joined":
      return `${event.playerName ?? "A player"} joined`;
    case "player_left":
      return `${event.playerName ?? "A player"} left`;
  }
}

function eventColor(type: ServerEvent["type"]): string {
  if (type === "server_offline" || type === "player_left") {
    return "red";
  }

  if (type === "server_restarted") {
    return "yellow";
  }

  return "green";
}

export function ServerMonitoring({ serverId }: ServerMonitoringProps) {
  const [metrics, setMetrics] = useState<ServerMetric[]>([]);
  const [events, setEvents] = useState<ServerEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (background = false) => {
      if (background) {
        setRefreshing(true);
      }

      try {
        const [nextMetrics, nextEvents] = await Promise.all([
          getServerHistory(serverId),
          getServerEvents(serverId),
        ]);
        setMetrics(nextMetrics);
        setEvents(nextEvents);
        setError(null);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load monitoring data.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [serverId],
  );

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(true), 30_000);
    return () => clearInterval(interval);
  }, [load]);

  if (loading) {
    return (
      <Stack gap="md" pt="lg">
        <Skeleton height={180} radius="md" />
        <Skeleton height={260} radius="md" />
      </Stack>
    );
  }

  const recentMetrics = metrics.slice(-20).reverse();

  return (
    <Stack gap="lg" pt="lg">
      <Group justify="space-between">
        <div>
          <Title order={2}>Monitoring</Title>
          <Text c="dimmed">
            Historical health samples and significant server activity.
          </Text>
        </div>
        <Group gap="sm">
          {refreshing && <Loader size="sm" />}
          <Button
            variant="light"
            onClick={() => void load(true)}
            disabled={refreshing}
          >
            Refresh
          </Button>
        </Group>
      </Group>

      {error && <Alert color="red">{error}</Alert>}

      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <Card withBorder radius="md" p="lg">
          <Stack gap="md">
            <Title order={3}>Recent Events</Title>
            {events.length === 0 ? (
              <Text c="dimmed">No server events recorded yet.</Text>
            ) : (
              <Stack gap="sm">
                {events.slice(0, 10).map((event) => (
                  <Group key={event.id} justify="space-between" wrap="nowrap">
                    <Group gap="sm" wrap="nowrap">
                      <Badge
                        circle
                        color={eventColor(event.type)}
                        aria-label={event.type}
                      >
                        {" "}
                      </Badge>
                      <Text size="sm">{eventLabel(event)}</Text>
                    </Group>
                    <Text size="xs" c="dimmed" ta="right">
                      {dateTime(event.occurredAt)}
                    </Text>
                  </Group>
                ))}
              </Stack>
            )}
          </Stack>
        </Card>

        <Card withBorder radius="md" p="lg">
          <Stack gap="md">
            <Title order={3}>Collection</Title>
            <div>
              <Text size="xs" c="dimmed">
                Recent Samples
              </Text>
              <Text fw={600} size="xl">
                {metrics.length}
              </Text>
            </div>
            <Text size="sm" c="dimmed">
              Metrics are sampled by the PalCenter API every 30 seconds by
              default and stored in SQLite.
            </Text>
          </Stack>
        </Card>
      </SimpleGrid>

      <Card withBorder radius="md" p="lg">
        <Stack gap="md">
          <Title order={3}>Metric History</Title>
          {recentMetrics.length === 0 ? (
            <Text c="dimmed">Waiting for the first metric sample.</Text>
          ) : (
            <ScrollArea>
              <Table striped highlightOnHover miw={720}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Captured</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Players</Table.Th>
                    <Table.Th>FPS</Table.Th>
                    <Table.Th>Response</Table.Th>
                    <Table.Th>Uptime</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {recentMetrics.map((metric) => (
                    <Table.Tr key={metric.id}>
                      <Table.Td>{dateTime(metric.capturedAt)}</Table.Td>
                      <Table.Td>
                        <Badge
                          color={metric.status === "online" ? "green" : "red"}
                          variant="light"
                        >
                          {metric.status}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        {metric.playerCount === null
                          ? "—"
                          : `${metric.playerCount}/${metric.maxPlayers ?? "—"}`}
                      </Table.Td>
                      <Table.Td>{known(metric.fps)}</Table.Td>
                      <Table.Td>{known(metric.responseTimeMs, " ms")}</Table.Td>
                      <Table.Td>{known(metric.uptimeSeconds, " sec")}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          )}
        </Stack>
      </Card>
    </Stack>
  );
}
