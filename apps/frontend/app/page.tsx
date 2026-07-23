"use client";

import {
  Alert,
  Button,
  Card,
  Container,
  Group,
  Loader,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AddServerDialog } from "../components/AddServerDialog";
import { EmptyState } from "../components/EmptyState";
import { ServerCard } from "../components/ServerCard";
import { getServerStatus } from "../lib/api";
import type { ServerStatus } from "../types/servers";

export default function HomePage() {
  const [dialogOpened, dialog] = useDisclosure(false);
  const [servers, setServers] = useState<ServerStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadServers = useCallback(async (background = false) => {
    if (background) {
      setRefreshing(true);
    }

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
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      await loadServers(true);

      if (!cancelled) {
        timeout = setTimeout(poll, 5_000);
      }
    };

    void loadServers().then(() => {
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
  }, [loadServers]);

  return (
    <Container size="lg" py={80}>
      <Stack gap="xl">
        <Group justify="space-between" align="end">
          <div>
            <Title order={1}>PalCenter</Title>
            <Text c="dimmed">Remote Palworld Server Manager</Text>
          </div>
          <Group>
            <Button component={Link} href="/notifications" variant="light">
              Notifications
            </Button>
            <Button onClick={dialog.open}>Add Server</Button>
          </Group>
        </Group>

        <Group justify="space-between" mih={24}>
          {error ? (
            <Alert color="red" style={{ flex: 1 }}>
              {error}
            </Alert>
          ) : (
            <span />
          )}
          {refreshing && (
            <Group gap="xs">
              <Loader size="xs" />
              <Text size="xs" c="dimmed">
                Refreshing
              </Text>
            </Group>
          )}
        </Group>

        {!loading && servers.length === 0 && (
          <EmptyState onAddServer={dialog.open} />
        )}

        {loading && (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
            {[0, 1, 2].map((item) => (
              <Card key={item} withBorder radius="md" p="lg">
                <Stack>
                  <Skeleton height={28} width="60%" />
                  <Skeleton height={16} width="80%" />
                  <Skeleton height={110} />
                </Stack>
              </Card>
            ))}
          </SimpleGrid>
        )}

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
          {servers.map((server) => (
            <ServerCard key={server.id} server={server} />
          ))}
        </SimpleGrid>
      </Stack>

      <AddServerDialog
        opened={dialogOpened}
        onClose={dialog.close}
        onSaved={() => loadServers()}
      />
    </Container>
  );
}
