"use client";

import {
  Alert,
  Anchor,
  Breadcrumbs,
  Button,
  Card,
  Container,
  Group,
  Modal,
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
import { NotificationProviderCard } from "./NotificationProviderCard";
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
  const [pendingDelete, setPendingDelete] =
    useState<NotificationConfiguration | null>(null);
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
    setBusyId(provider.id);

    try {
      await deleteNotification(provider.id);
      setPendingDelete(null);
      await load();
      notifications.show({
        color: "green",
        title: "Provider deleted",
        message: `${provider.name} was removed.`,
      });
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
                <NotificationProviderCard
                  key={provider.id}
                  provider={provider}
                  busy={busy}
                  onTest={() => void sendTest(provider)}
                  onEdit={() => openEdit(provider)}
                  onToggle={() => void toggle(provider)}
                  onDelete={() => setPendingDelete(provider)}
                />
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

      <Modal
        opened={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Delete notification provider?"
        centered
        closeOnClickOutside={busyId === null}
        closeOnEscape={busyId === null}
      >
        <Stack>
          <Text>
            {pendingDelete
              ? `Delete "${pendingDelete.name}"? It will stop receiving notifications immediately.`
              : ""}
          </Text>
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => setPendingDelete(null)}
              disabled={busyId !== null}
            >
              Cancel
            </Button>
            <Button
              color="red"
              loading={busyId !== null}
              onClick={() => {
                if (pendingDelete) {
                  void remove(pendingDelete);
                }
              }}
            >
              Delete Provider
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
