"use client";

import {
  Alert,
  Anchor,
  Badge,
  Breadcrumbs,
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
import { notifications } from "@mantine/notifications";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  deleteNotification,
  getNotifications,
  testNotification,
  updateNotification,
} from "../lib/api";
import type {
  NotificationConfiguration,
  NotificationConfigurationUpdate,
} from "../types/servers";
import { NotificationProviderDialog } from "./NotificationProviderDialog";

function updateInput(
  provider: NotificationConfiguration,
  enabled: boolean,
): NotificationConfigurationUpdate {
  const common = {
    name: provider.name,
    enabled,
    events: provider.events,
  };

  return provider.type === "discord"
    ? { ...common, type: "discord" }
    : {
        ...common,
        type: "ntfy",
        serverUrl: provider.serverUrl,
        topic: provider.topic,
      };
}

export function NotificationSettings() {
  const [providers, setProviders] = useState<NotificationConfiguration[]>([]);
  const [selected, setSelected] = useState<NotificationConfiguration | null>(
    null,
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setProviders(await getNotifications());
      setError(null);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load notification providers.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openAdd = () => {
    setSelected(null);
    setDialogOpen(true);
  };

  const openEdit = (provider: NotificationConfiguration) => {
    setSelected(provider);
    setDialogOpen(true);
  };

  const toggle = async (provider: NotificationConfiguration) => {
    setBusyId(provider.id);

    try {
      await updateNotification(
        provider.id,
        updateInput(provider, !provider.enabled),
      );
      await load();
    } catch (requestError) {
      notifications.show({
        color: "red",
        title: "Unable to update provider",
        message:
          requestError instanceof Error
            ? requestError.message
            : "The provider could not be updated.",
      });
    } finally {
      setBusyId(null);
    }
  };

  const sendTest = async (provider: NotificationConfiguration) => {
    setBusyId(provider.id);

    try {
      const result = await testNotification(provider.id);
      notifications.show({
        color: "green",
        title: "Notification delivered",
        message: result.message,
      });
    } catch (requestError) {
      notifications.show({
        color: "red",
        title: "Test notification failed",
        message:
          requestError instanceof Error
            ? requestError.message
            : "The notification could not be delivered.",
      });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (provider: NotificationConfiguration) => {
    if (!window.confirm(`Delete notification provider "${provider.name}"?`)) {
      return;
    }

    setBusyId(provider.id);

    try {
      await deleteNotification(provider.id);
      await load();
    } catch (requestError) {
      notifications.show({
        color: "red",
        title: "Unable to delete provider",
        message:
          requestError instanceof Error
            ? requestError.message
            : "The provider could not be deleted.",
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Container size="lg" py={{ base: 32, sm: 64 }}>
      <Stack gap="xl">
        <Group justify="space-between" align="center">
          <Breadcrumbs>
            <Anchor component={Link} href="/">
              Dashboard
            </Anchor>
            <Text>Notifications</Text>
          </Breadcrumbs>
          <Button onClick={openAdd}>Add Provider</Button>
        </Group>

        <div>
          <Title order={1}>Notification Settings</Title>
          <Text c="dimmed">
            Deliver selected PalCenter server events to external services.
          </Text>
        </div>

        {error && <Alert color="red">{error}</Alert>}

        {loading ? (
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <Skeleton height={220} radius="md" />
            <Skeleton height={220} radius="md" />
          </SimpleGrid>
        ) : providers.length === 0 ? (
          <Card withBorder radius="md" p="xl">
            <Stack align="center">
              <Title order={3}>No notification providers configured</Title>
              <Text c="dimmed" ta="center">
                Add Discord or ntfy to receive important server events.
              </Text>
              <Button onClick={openAdd}>Add Provider</Button>
            </Stack>
          </Card>
        ) : (
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            {providers.map((provider) => {
              const busy = busyId === provider.id;

              return (
                <Card key={provider.id} withBorder radius="md" p="lg">
                  <Stack>
                    <Group justify="space-between">
                      <div>
                        <Title order={3}>{provider.name}</Title>
                        <Text c="dimmed" tt="capitalize">
                          {provider.type}
                        </Text>
                      </div>
                      <Badge
                        color={provider.enabled ? "green" : "gray"}
                        variant="light"
                      >
                        {provider.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </Group>

                    {provider.type === "discord" ? (
                      <Text size="sm">
                        Webhook:{" "}
                        {provider.webhookConfigured
                          ? "Configured"
                          : "Not configured"}
                      </Text>
                    ) : (
                      <Text size="sm">
                        {provider.serverUrl.replace(/\/+$/, "")}/
                        {provider.topic}
                      </Text>
                    )}

                    <Text size="sm" c="dimmed">
                      {provider.events.length} event
                      {provider.events.length === 1 ? "" : "s"} selected
                    </Text>

                    <Group mt="auto">
                      <Button
                        size="xs"
                        variant="light"
                        onClick={() => void sendTest(provider)}
                        disabled={busy}
                      >
                        {busy ? <Loader size="xs" /> : "Send Test"}
                      </Button>
                      <Button
                        size="xs"
                        variant="default"
                        onClick={() => openEdit(provider)}
                        disabled={busy}
                      >
                        Edit
                      </Button>
                      <Button
                        size="xs"
                        variant="subtle"
                        onClick={() => void toggle(provider)}
                        disabled={busy}
                      >
                        {provider.enabled ? "Disable" : "Enable"}
                      </Button>
                      <Button
                        size="xs"
                        color="red"
                        variant="subtle"
                        onClick={() => void remove(provider)}
                        disabled={busy}
                      >
                        Delete
                      </Button>
                    </Group>
                  </Stack>
                </Card>
              );
            })}
          </SimpleGrid>
        )}
      </Stack>

      <NotificationProviderDialog
        key={`${selected?.id ?? "new"}-${dialogOpen}`}
        opened={dialogOpen}
        provider={selected}
        onClose={() => setDialogOpen(false)}
        onSaved={load}
      />
    </Container>
  );
}
