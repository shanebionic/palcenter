"use client";

import {
  Badge,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import type { ReactNode } from "react";
import type { ServerWorkspaceData } from "../types/servers";

interface ServerOverviewProps {
  server: ServerWorkspaceData;
}

interface DetailProps {
  label: string;
  value: ReactNode;
}

function Detail({ label, value }: DetailProps) {
  return (
    <div>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text fw={500}>{value}</Text>
    </div>
  );
}

function known(value: string | number | null): string {
  return value === null || value === "" ? "Unknown" : String(value);
}

function formatLastUpdated(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(value));
}

export function ServerOverview({ server }: ServerOverviewProps) {
  const { configuration, connection, status } = server;
  const online = status.status === "online";

  return (
    <Stack gap="lg">
      <Card withBorder radius="md" p="lg">
        <Group justify="space-between" align="start">
          <div>
            <Text size="sm" c="dimmed">
              Display Name
            </Text>
            <Title order={2}>{connection.name}</Title>
            <Text c="dimmed">{status.serverName ?? "Unknown"}</Text>
          </div>
          <Badge color={online ? "green" : "red"} size="lg" variant="light">
            {online ? "Online" : "Offline"}
          </Badge>
        </Group>
      </Card>

      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <Card withBorder radius="md" p="lg">
          <Stack gap="md">
            <Title order={3}>Server Status</Title>
            <SimpleGrid cols={{ base: 1, xs: 2 }}>
              <Detail label="Version" value={known(status.version)} />
              <Detail
                label="Players"
                value={
                  online
                    ? `${status.players ?? 0}/${status.maxPlayers ?? 0}`
                    : "Unknown"
                }
              />
              <Detail label="FPS" value={known(status.fps)} />
              <Detail
                label="Response Time"
                value={
                  status.responseTimeMs === null
                    ? "Unknown"
                    : `${status.responseTimeMs} ms`
                }
              />
              <Detail
                label="Last Updated"
                value={formatLastUpdated(status.lastUpdated)}
              />
            </SimpleGrid>
          </Stack>
        </Card>

        <Card withBorder radius="md" p="lg">
          <Stack gap="md">
            <Title order={3}>Configuration</Title>
            <SimpleGrid cols={{ base: 1, xs: 2 }}>
              <Detail label="REST URL" value={configuration.restUrl} />
              <Detail label="Region" value={known(configuration.region)} />
              <Detail
                label="Crossplay Platforms"
                value={known(configuration.crossplayPlatforms)}
              />
            </SimpleGrid>
          </Stack>
        </Card>
      </SimpleGrid>

      <Card withBorder radius="md" p="lg">
        <Stack gap="md">
          <Title order={3}>Networking</Title>
          <SimpleGrid cols={{ base: 1, xs: 2, md: 3 }}>
            <Detail label="Public IP" value={known(configuration.publicIp)} />
            <Detail
              label="Public Port"
              value={known(configuration.publicPort)}
            />
            <Detail label="REST Port" value={known(configuration.restPort)} />
            <Detail
              label="RCON Enabled"
              value={
                configuration.rconEnabled === null
                  ? "Unknown"
                  : configuration.rconEnabled
                    ? "Yes"
                    : "No"
              }
            />
            <Detail label="RCON Port" value={known(configuration.rconPort)} />
          </SimpleGrid>
        </Stack>
      </Card>
    </Stack>
  );
}
