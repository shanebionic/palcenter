"use client";

import {
  Badge,
  Button,
  Card,
  Divider,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import Link from "next/link";
import type { ServerStatus } from "../types/servers";

interface ServerCardProps {
  server: ServerStatus;
}

interface MetricProps {
  label: string;
  value: string;
}

function Metric({ label, value }: MetricProps) {
  return (
    <div>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text fw={500}>{value}</Text>
    </div>
  );
}

function formatLastUpdated(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    timeStyle: "medium",
  }).format(new Date(value));
}

export function ServerCard({ server }: ServerCardProps) {
  const online = server.status === "online";

  return (
    <Card withBorder shadow="sm" radius="md" p="lg">
      <Stack gap="md">
        <Group justify="space-between" align="start" wrap="nowrap">
          <div>
            <Title order={3}>{server.name}</Title>
            <Text size="sm" c="dimmed" lineClamp={1}>
              {server.serverName ?? "Server unavailable"}
            </Text>
          </div>
          <Badge color={online ? "green" : "red"} variant="light">
            {online ? "Online" : "Offline"}
          </Badge>
        </Group>

        <Divider />

        <SimpleGrid cols={2} spacing="sm">
          <Metric
            label="Players"
            value={
              online ? `${server.players ?? 0}/${server.maxPlayers ?? 0}` : "—"
            }
          />
          <Metric label="FPS" value={online ? String(server.fps ?? 0) : "—"} />
          <Metric label="Version" value={server.version ?? "—"} />
          <Metric
            label="Response Time"
            value={
              server.responseTimeMs === null
                ? "—"
                : `${server.responseTimeMs} ms`
            }
          />
        </SimpleGrid>

        <Group justify="space-between" align="center">
          <Text size="xs" c="dimmed">
            Updated {formatLastUpdated(server.lastUpdated)}
          </Text>
          <Button
            component={Link}
            href={`/servers/${server.id}`}
            variant="light"
            size="xs"
          >
            Manage
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
