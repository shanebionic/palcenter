"use client";

import {
  Alert,
  Anchor,
  Breadcrumbs,
  Button,
  Center,
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
import type { ServerWorkspaceData } from "../types/servers";
import { ServerOverview } from "./ServerOverview";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ??
  "http://localhost:3001";

interface ServerWorkspaceProps {
  serverId: string;
}

function ComingSoon() {
  return (
    <Center mih={240}>
      <Stack align="center" gap="xs">
        <Title order={3}>Coming Soon</Title>
        <Text c="dimmed">This workspace will be implemented later.</Text>
      </Stack>
    </Center>
  );
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
        const response = await fetch(`${apiUrl}/api/servers/${serverId}`, {
          cache: "no-store",
        });

        if (response.status === 404) {
          throw new Error("This server no longer exists.");
        }

        if (!response.ok) {
          throw new Error(
            `Unable to load the server (HTTP ${response.status}).`,
          );
        }

        setServer((await response.json()) as ServerWorkspaceData);
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
                <ComingSoon />
              </Tabs.Panel>
              <Tabs.Panel value="administration">
                <ComingSoon />
              </Tabs.Panel>
              <Tabs.Panel value="settings">
                <ComingSoon />
              </Tabs.Panel>
            </Tabs>
          </>
        )}
      </Stack>
    </Container>
  );
}
