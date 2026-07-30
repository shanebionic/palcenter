"use client";

import { Alert, Button, Group, Modal, Stack, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconTrash } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteServer } from "../lib/api";
import {
  serverRemovalDescription,
  serverRemovalTitle,
} from "../lib/server-removal";
import { DangerCard } from "./ui/DangerCard";
import { SectionHeader } from "./ui/SectionHeader";

interface ServerDangerZoneProps {
  serverId: string;
  serverName: string;
}

export function ServerDangerZone({
  serverId,
  serverName,
}: ServerDangerZoneProps) {
  const router = useRouter();
  const [opened, setOpened] = useState(false);
  const [removing, setRemoving] = useState(false);

  const remove = async () => {
    setRemoving(true);

    try {
      await deleteServer(serverId);
      notifications.show({
        color: "green",
        title: "Server removed",
        message: `${serverName} was removed from PalCenter.`,
      });
      setOpened(false);
      router.replace("/");
      router.refresh();
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Unable to remove server",
        message:
          error instanceof Error
            ? error.message
            : "The saved server connection could not be removed.",
      });
    } finally {
      setRemoving(false);
    }
  };

  return (
    <>
      <Stack gap="md">
        <SectionHeader
          title="Danger zone"
          description="Permanently remove PalCenter-owned data for this server."
        />
        <DangerCard>
          <Group justify="space-between" align="center">
            <div>
              <Title order={3}>Remove server</Title>
              <Text c="dimmed" size="sm">
                Remove this saved connection and its metrics, events, and
                tracked player state from PalCenter.
              </Text>
            </div>
            <Button
              color="red"
              leftSection={<IconTrash size={18} />}
              onClick={() => setOpened(true)}
            >
              Remove server
            </Button>
          </Group>
        </DangerCard>
      </Stack>

      <Modal
        opened={opened}
        onClose={() => {
          if (!removing) {
            setOpened(false);
          }
        }}
        title={serverRemovalTitle(serverName)}
        centered
        closeOnClickOutside={!removing}
        closeOnEscape={!removing}
      >
        <Stack>
          <Alert color="red" title="This cannot be undone">
            {serverRemovalDescription}
          </Alert>
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => setOpened(false)}
              disabled={removing}
            >
              Cancel
            </Button>
            <Button
              color="red"
              leftSection={<IconTrash size={18} />}
              loading={removing}
              onClick={() => void remove()}
            >
              Remove server
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
