"use client";

import {
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import {
  IconActivityHeartbeat,
  IconClock,
  IconGauge,
  IconLock,
  IconServer,
  IconUsers,
} from "@tabler/icons-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { ServerStatus } from "../types/servers";

interface ServerCardProps {
  server: ServerStatus;
}

interface MetricProps {
  label: string;
  value: string;
  icon: ReactNode;
}

function HealthMetric({ label, value, icon }: MetricProps) {
  return (
    <Paper withBorder radius="sm" p="sm">
      <Stack gap={4}>
        <Group gap={6} c="dimmed">
          {icon}
          <Text size="xs">{label}</Text>
        </Group>
        <Text fw={600}>{value}</Text>
      </Stack>
    </Paper>
  );
}

function formatLastUpdated(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    timeStyle: "medium",
  }).format(new Date(value));
}

function formatUptime(value: number | null): string {
  if (value === null) {
    return "Unknown";
  }

  const totalSeconds = Math.max(0, Math.floor(value));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return `${totalSeconds}s`;
}

export function ServerCard({ server }: ServerCardProps) {
  const online = server.status === "online";

  return (
    <Card withBorder shadow="sm" radius="md" p="lg">
      <Stack gap="md">
        <Group justify="space-between" align="start" wrap="nowrap">
          <div>
            <Group gap="xs" wrap="nowrap">
              <Title order={3}>{server.name}</Title>
              {server.passwordProtected && (
                <IconLock size={18} aria-label="Password protected" />
              )}
            </Group>
            <Text size="sm" c="dimmed" lineClamp={1}>
              {server.serverName ?? "Server unavailable"}
            </Text>
          </div>
          <Badge color={online ? "green" : "red"} variant="dot">
            {online ? "Online" : "Offline"}
          </Badge>
        </Group>

        <Divider />

        <SimpleGrid cols={2} spacing="sm">
          <HealthMetric
            label="Players"
            icon={<IconUsers size={16} />}
            value={
              server.players === null || server.maxPlayers === null
                ? "Unknown"
                : `${server.players}/${server.maxPlayers}`
            }
          />
          <HealthMetric
            label="FPS"
            icon={<IconGauge size={16} />}
            value={server.fps === null ? "Unknown" : String(server.fps)}
          />
          <HealthMetric
            label="Uptime"
            icon={<IconClock size={16} />}
            value={formatUptime(server.uptimeSeconds)}
          />
          <HealthMetric
            label="Response Time"
            icon={<IconActivityHeartbeat size={16} />}
            value={
              server.responseTimeMs === null
                ? "Unknown"
                : `${server.responseTimeMs} ms`
            }
          />
          <HealthMetric
            label="Version"
            icon={<IconServer size={16} />}
            value={server.version ?? "Unknown"}
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
