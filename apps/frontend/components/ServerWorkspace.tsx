"use client";

import {
  Alert,
  Anchor,
  Breadcrumbs,
  Button,
  Container,
  Group,
  Loader,
  Skeleton,
  Stack,
  Tabs,
  Text,
  Title,
} from "@mantine/core";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getServer } from "../lib/api";
import type { ServerWorkspaceData } from "../types/servers";
import { ServerAdministration } from "./ServerAdministration";
import { ServerOverview } from "./ServerOverview";
import { ServerPlayers } from "./ServerPlayers";
import { ServerSettings } from "./ServerSettings";

interface ServerWorkspaceProps {
  serverId: string;
}

export function ServerWorkspace({ serverId }: ServerWorkspaceProps) {
  const [server, setServer] = useState<ServerWorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadServer = useCallback(
    async (background = false) => {
      if (background) {
        setRefreshing(true);
      }

      setError(null);

      try {
        setServer(await getServer(serverId));
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load the server.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [serverId],
  );

  useEffect(() => {
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      await loadServer(true);

      if (!cancelled) {
        timeout = setTimeout(poll, 5_000);
      }
    };

    void loadServer().then(() => {
      if (!cancelled) {
        timeout = setTimeout(poll, 5_000);
      }
    });

    return () => {
      cancelled = true;

      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [loadServer]);

  return (
    <Container size="lg" py={{ base: 32, sm: 64 }}>
      <Stack gap="xl">
        <Group justify="space-between" align="center">
          <Breadcrumbs>
            <Anchor component={Link} href="/">
              Dashboard
            </Anchor>
            <Text>{server?.connection.name ?? "Server"}</Text>
          </Breadcrumbs>
          <Button component={Link} href="/" variant="light">
            Back to Dashboard
          </Button>
        </Group>

        {error && <Alert color="red">{error}</Alert>}

        {loading && (
          <Stack gap="md">
            <Skeleton height={110} radius="md" />
            <Skeleton height={360} radius="md" />
          </Stack>
        )}

        {!loading && server && (
          <>
            <Group justify="space-between">
              <div>
                <Title order={1}>{server.connection.name}</Title>
                <Text c="dimmed">Server Workspace</Text>
              </div>
              {refreshing && <Loader size="sm" />}
            </Group>

            <Tabs defaultValue="overview" keepMounted={false}>
              <Tabs.List>
                <Tabs.Tab value="overview">Overview</Tabs.Tab>
                <Tabs.Tab value="players">Players</Tabs.Tab>
                <Tabs.Tab value="administration">Administration</Tabs.Tab>
                <Tabs.Tab value="settings">Settings</Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="overview" pt="lg">
                <ServerOverview server={server} />
              </Tabs.Panel>
              <Tabs.Panel value="players">
                <ServerPlayers serverId={server.connection.id} />
              </Tabs.Panel>
              <Tabs.Panel value="administration">
                <ServerAdministration
                  serverId={server.connection.id}
                  serverName={server.connection.name}
                />
              </Tabs.Panel>
              <Tabs.Panel value="settings">
                <ServerSettings serverId={server.connection.id} />
              </Tabs.Panel>
            </Tabs>
          </>
        )}
      </Stack>
    </Container>
  );
}
