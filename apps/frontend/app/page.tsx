"use client";

import {
  Alert,
  Badge,
  Button,
  Group,
  SimpleGrid,
  Stack,
  Text,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconActivityHeartbeat,
  IconPlus,
  IconServer,
  IconUsers,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AddServerDialog } from "../components/AddServerDialog";
import { ApplicationShell } from "../components/ApplicationShell";
import { BrandedLoader } from "../components/BrandedLoader";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { ServerCard } from "../components/ServerCard";
import { StatCard } from "../components/ui/StatCard";
import { getServerStatus, getSession, type AuthSession } from "../lib/api";
import type { ServerStatus } from "../types/servers";

export default function HomePage() {
  const [dialogOpened, dialog] = useDisclosure(false);
  const [servers, setServers] = useState<ServerStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);

  const loadServers = useCallback(async (background = false) => {
    if (background) setRefreshing(true);
    setError(null);
    try {
      setServers(await getServerStatus());
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load servers.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void getSession()
      .then(setSession)
      .catch(() => undefined);
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      await loadServers(true);
      if (!cancelled) timeout = setTimeout(poll, 5_000);
    };
    void loadServers().then(() => {
      if (!cancelled) timeout = setTimeout(poll, 5_000);
    });
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [loadServers]);

  const summary = useMemo(() => {
    const online = servers.filter((server) => server.status === "online");
    return {
      online: online.length,
      players: online.reduce(
        (total, server) => total + (server.players ?? 0),
        0,
      ),
      responseTimes: online
        .map((server) => server.responseTimeMs)
        .filter((value): value is number => value !== null),
    };
  }, [servers]);

  const averageResponse =
    summary.responseTimes.length === 0
      ? "—"
      : `${Math.round(
          summary.responseTimes.reduce((total, value) => total + value, 0) /
            summary.responseTimes.length,
        )} ms`;
  const isAdministrator = session?.user.role === "administrator";

  return (
    <ApplicationShell>
      <Stack gap="xl">
        <PageHeader
          eyebrow="Fleet Overview"
          title="Server Command Center"
          description="Monitor every connected Palworld world and jump into operations from one place."
          action={
            isAdministrator ? (
              <Button
                leftSection={<IconPlus size={18} />}
                onClick={dialog.open}
              >
                Add Server
              </Button>
            ) : null
          }
        />

        {error && <Alert color="red">{error}</Alert>}

        {loading ? (
          <BrandedLoader message="Scanning your Palworld fleet" />
        ) : servers.length === 0 ? (
          <EmptyState onAddServer={isAdministrator ? dialog.open : undefined} />
        ) : (
          <>
            <SimpleGrid cols={{ base: 2, lg: 4 }}>
              <StatCard
                label="Configured"
                value={String(servers.length)}
                icon={<IconServer size={20} />}
                color="cyan"
              />
              <StatCard
                label="Online"
                value={`${summary.online}/${servers.length}`}
                icon={<IconActivityHeartbeat size={20} />}
                color="green"
              />
              <StatCard
                label="Active Players"
                value={String(summary.players)}
                icon={<IconUsers size={20} />}
                color="blue"
              />
              <StatCard
                label="Avg. Response"
                value={averageResponse}
                icon={<IconActivityHeartbeat size={20} />}
                color="violet"
              />
            </SimpleGrid>

            <Group justify="space-between" align="center">
              <div>
                <Text fw={700} size="lg">
                  Your Servers
                </Text>
                <Text size="sm" c="dimmed">
                  Live status refreshes every five seconds.
                </Text>
              </div>
              {refreshing && (
                <Badge variant="light" color="cyan">
                  Syncing
                </Badge>
              )}
            </Group>

            <SimpleGrid
              cols={{ base: 1, lg: servers.length === 1 ? 1 : 2 }}
              spacing="lg"
            >
              {servers.map((server) => (
                <ServerCard key={server.id} server={server} />
              ))}
            </SimpleGrid>
          </>
        )}
      </Stack>

      <AddServerDialog
        opened={dialogOpened}
        onClose={dialog.close}
        onSaved={() => loadServers()}
      />
    </ApplicationShell>
  );
}
