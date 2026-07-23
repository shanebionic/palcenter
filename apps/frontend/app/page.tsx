"use client";

import {
  Alert,
  Button,
  Card,
  Container,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useCallback, useEffect, useState } from "react";
import { AddServerDialog } from "../components/AddServerDialog";
import { EmptyState } from "../components/EmptyState";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ??
  "http://localhost:3001";

interface Server {
  id: string;
  name: string;
  baseUrl: string;
}

interface ServersResponse {
  servers: Server[];
}

export default function HomePage() {
  const [dialogOpened, dialog] = useDisclosure(false);
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadServers = useCallback(async () => {
    setError(null);

    try {
      const response = await fetch(`${apiUrl}/api/servers`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Unable to load servers (HTTP ${response.status}).`);
      }

      const result = (await response.json()) as ServersResponse;
      setServers(result.servers);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load servers.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadServers();
  }, [loadServers]);

  return (
    <Container size="lg" py={80}>
      <Stack gap="xl">
        <Group justify="space-between" align="end">
          <div>
            <Title order={1}>PalCenter</Title>
            <Text c="dimmed">Remote Palworld Server Manager</Text>
          </div>
          <Button onClick={dialog.open}>Add Server</Button>
        </Group>

        {error && <Alert color="red">{error}</Alert>}

        {!loading && servers.length === 0 && (
          <EmptyState onAddServer={dialog.open} />
        )}

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
          {servers.map((server) => (
            <Card key={server.id} withBorder shadow="sm" radius="md" p="lg">
              <Stack gap="xs">
                <Title order={3}>{server.name}</Title>
                <Text size="sm" c="dimmed">
                  {server.baseUrl}
                </Text>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>
      </Stack>

      <AddServerDialog
        opened={dialogOpened}
        onClose={dialog.close}
        onSaved={loadServers}
      />
    </Container>
  );
}
