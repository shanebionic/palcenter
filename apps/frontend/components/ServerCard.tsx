"use client";

import {
  Badge,
  Button,
  Card,
  Group,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import {
  IconActivityHeartbeat,
  IconArrowRight,
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

function formatLastUpdated(value: string): string {
  return new Intl.DateTimeFormat(undefined, { timeStyle: "medium" }).format(
    new Date(value),
  );
}

function formatUptime(value: number | null): string {
  if (value === null) return "Unknown";
  const seconds = Math.max(0, Math.floor(value));
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return minutes > 0 ? `${minutes}m` : `${seconds}s`;
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Group gap="sm" wrap="nowrap">
      <ThemeIcon variant="light" color="gray" size="lg" radius="md">
        {icon}
      </ThemeIcon>
      <div>
        <Text size="xs" c="dimmed">
          {label}
        </Text>
        <Text fw={650}>{value}</Text>
      </div>
    </Group>
  );
}

export function ServerCard({ server }: ServerCardProps) {
  const online = server.status === "online";
  const players =
    server.players === null || server.maxPlayers === null
      ? "Unknown"
      : `${server.players}/${server.maxPlayers}`;
  const capacity =
    server.players !== null && server.maxPlayers
      ? (server.players / server.maxPlayers) * 100
      : 0;

  return (
    <Card
      className="pc-server-card"
      style={{ "--server-accent": online ? "#22c55e" : "#ef4444" }}
      withBorder
      radius="lg"
      p={{ base: "lg", sm: "xl" }}
    >
      <Stack gap="xl">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Group gap="md" wrap="nowrap">
            <ThemeIcon
              size={48}
              radius="lg"
              color={online ? "green" : "red"}
              variant="light"
            >
              <IconServer size={25} />
            </ThemeIcon>
            <div>
              <Group gap="xs">
                <Title order={3}>{server.name}</Title>
                {server.passwordProtected && (
                  <IconLock size={16} aria-label="Password protected" />
                )}
              </Group>
              <Text size="sm" c="dimmed" lineClamp={1}>
                {server.serverName ?? "Remote server unavailable"}
              </Text>
            </div>
          </Group>
          <Badge color={online ? "green" : "red"} variant="light" size="lg">
            {online ? "Online" : "Offline"}
          </Badge>
        </Group>

        <div>
          <Group justify="space-between" mb={7}>
            <Text size="xs" c="dimmed">
              Player capacity
            </Text>
            <Text size="xs" fw={650}>
              {players}
            </Text>
          </Group>
          <Progress
            value={capacity}
            color={capacity > 85 ? "orange" : "cyan"}
            size="sm"
            radius="xl"
          />
        </div>

        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="lg">
          <Metric icon={<IconUsers size={18} />} label="Players" value={players} />
          <Metric
            icon={<IconGauge size={18} />}
            label="Server FPS"
            value={server.fps === null ? "Unknown" : String(server.fps)}
          />
          <Metric
            icon={<IconClock size={18} />}
            label="Uptime"
            value={formatUptime(server.uptimeSeconds)}
          />
          <Metric
            icon={<IconActivityHeartbeat size={18} />}
            label="Response"
            value={
              server.responseTimeMs === null
                ? "Unknown"
                : `${server.responseTimeMs} ms`
            }
          />
        </SimpleGrid>

        <Group justify="space-between" align="center">
          <Stack gap={1}>
            <Text size="xs" c="dimmed">
              {server.version ?? "Version unknown"}
            </Text>
            <Text size="xs" c="dimmed">
              Updated {formatLastUpdated(server.lastUpdated)}
            </Text>
          </Stack>
          <Button
            component={Link}
            href={`/servers/${server.id}`}
            variant="light"
            rightSection={<IconArrowRight size={16} />}
          >
            Manage
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
