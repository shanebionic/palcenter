"use client";

import { Badge, Button, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { useCallback, useEffect, useState } from "react";
import { getCompanionStatus, refreshCompanionStatus } from "../lib/api";
import type { CompanionStatus } from "../types/companion";
import { SectionCard } from "./ui/SectionCard";
import { SectionHeader } from "./ui/SectionHeader";

export function CompanionStatusCard({ serverId }: { serverId: string }) {
  const [status, setStatus] = useState<CompanionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(
    async (refresh = false) => {
      setLoading(true);
      try {
        setStatus(
          await (refresh
            ? refreshCompanionStatus(serverId)
            : getCompanionStatus(serverId)),
        );
      } finally {
        setLoading(false);
      }
    },
    [serverId],
  );
  useEffect(() => {
    void load();
  }, [load]);

  const connected = status?.status === "connected";
  const capabilities = Object.entries(status?.capabilities ?? {}).filter(
    ([, value]) => value.supported,
  );
  return (
    <SectionCard>
      <Stack gap="md">
        <SectionHeader
          title="PalCenter Companion"
          description="Optional authoritative server extension"
          action={
            <Button
              variant="light"
              size="xs"
              loading={loading}
              onClick={() => void load(true)}
            >
              Refresh
            </Button>
          }
        />
        <Group justify="space-between">
          <Text fw={600}>
            {connected ? "Connected" : "Not installed or unavailable"}
          </Text>
          <Badge color={connected ? "teal" : "gray"} variant="light">
            {connected ? "Healthy" : "Disconnected"}
          </Badge>
        </Group>
        {connected && status?.health && status.version ? (
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
            <Text size="sm">Version: {status.version.applicationVersion}</Text>
            <Text size="sm">API: {status.version.apiVersion}</Text>
            <Text size="sm">
              Palworld: {status.version.palworldVersion ?? "Not reported"}
            </Text>
            <Text size="sm">
              Uptime: {Math.floor(status.health.uptimeSeconds / 60)} minutes
            </Text>
            <Text size="sm">
              Build: {status.version.buildCommit ?? "Not reported"}
            </Text>
            <Text size="sm">
              Capabilities:{" "}
              {capabilities.length
                ? capabilities.map(([name]) => name).join(", ")
                : "Discovery only"}
            </Text>
          </SimpleGrid>
        ) : (
          <Text size="sm" c="dimmed">
            PalCenter continues using the official Palworld REST API. Install
            the Companion only when enhanced capabilities are needed.
          </Text>
        )}
      </Stack>
    </SectionCard>
  );
}
