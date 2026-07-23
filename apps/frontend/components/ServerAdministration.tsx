"use client";

import {
  Alert,
  Button,
  Card,
  Group,
  Modal,
  NumberInput,
  Stack,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useState } from "react";
import { announce, saveWorld, shutdown, stop } from "../lib/api";

const messageLimit = 500;

type AdminAction = "save" | "shutdown" | "stop";

interface ServerAdministrationProps {
  serverId: string;
  serverName: string;
}

export function ServerAdministration({
  serverId,
  serverName,
}: ServerAdministrationProps) {
  const [announcement, setAnnouncement] = useState("");
  const [shutdownMessage, setShutdownMessage] = useState("");
  const [waitTime, setWaitTime] = useState<number | string>(60);
  const [pendingAction, setPendingAction] = useState<AdminAction | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);

  const request = async (action: "announce" | AdminAction) => {
    setSubmitting(action);

    try {
      const result =
        action === "announce"
          ? await announce(serverId, announcement.trim())
          : action === "save"
            ? await saveWorld(serverId)
            : action === "shutdown"
              ? await shutdown(
                  serverId,
                  typeof waitTime === "number" ? waitTime : Number(waitTime),
                  shutdownMessage.trim() || undefined,
                )
              : await stop(serverId);

      notifications.show({
        color: "green",
        title: "Action completed",
        message: result.message,
      });
      setPendingAction(null);
      return true;
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Action failed",
        message: error instanceof Error ? error.message : "The request failed.",
      });
      return false;
    } finally {
      setSubmitting(null);
    }
  };

  const sendAnnouncement = async () => {
    const message = announcement.trim();

    if (!message) {
      return;
    }

    if (await request("announce")) {
      setAnnouncement("");
    }
  };

  const confirmAction = async () => {
    if (pendingAction === "save") {
      await request("save");
    }

    if (pendingAction === "shutdown") {
      await request("shutdown");
    }

    if (pendingAction === "stop") {
      await request("stop");
    }
  };

  const confirmation = {
    save: {
      title: "Save world?",
      description: "Save the current world state?",
      button: "Save World",
      color: "blue",
    },
    shutdown: {
      title: "Shutdown server?",
      description: `${serverName} will shut down after the configured wait time.`,
      button: "Shutdown Server",
      color: "orange",
    },
    stop: {
      title: "Force stop server?",
      description:
        "Force stopping may cause data loss. Any unsaved progress may be lost.",
      button: "Force Stop Server",
      color: "red",
    },
  } as const;

  const currentConfirmation = pendingAction
    ? confirmation[pendingAction]
    : null;

  return (
    <>
      <Stack gap="lg" pt="lg">
        <Title order={2}>Administration</Title>

        <Card withBorder padding="lg" radius="md">
          <Stack>
            <div>
              <Title order={3}>Broadcast</Title>
              <Text c="dimmed" size="sm">
                Send an announcement to everyone currently on the server.
              </Text>
            </div>
            <Textarea
              label="Announcement"
              placeholder="Server restarting in 10 minutes"
              value={announcement}
              onChange={(event) => setAnnouncement(event.currentTarget.value)}
              maxLength={messageLimit}
              autosize
              minRows={2}
              description={`${announcement.length}/${messageLimit} characters`}
            />
            <Group justify="flex-end">
              <Button
                onClick={sendAnnouncement}
                disabled={!announcement.trim() || submitting !== null}
                loading={submitting === "announce"}
              >
                Send
              </Button>
            </Group>
          </Stack>
        </Card>

        <Card withBorder padding="lg" radius="md">
          <Group justify="space-between" align="flex-end">
            <div>
              <Title order={3}>Save World</Title>
              <Text c="dimmed" size="sm">
                Save the current world state to disk.
              </Text>
            </div>
            <Button
              variant="light"
              onClick={() => setPendingAction("save")}
              disabled={submitting !== null}
            >
              Save World
            </Button>
          </Group>
        </Card>

        <Card withBorder padding="lg" radius="md">
          <Stack>
            <div>
              <Title order={3}>Server Shutdown</Title>
              <Text c="dimmed" size="sm">
                Shut down gracefully or force the server process to stop.
              </Text>
            </div>
            <Textarea
              label="Shutdown message"
              placeholder="The server will shut down for maintenance."
              value={shutdownMessage}
              onChange={(event) =>
                setShutdownMessage(event.currentTarget.value)
              }
              maxLength={messageLimit}
              description={`Optional · ${shutdownMessage.length}/${messageLimit} characters`}
            />
            <NumberInput
              label="Wait time"
              description="Seconds before the server shuts down."
              value={waitTime}
              onChange={setWaitTime}
              min={0}
              max={86_400}
              allowDecimal={false}
              suffix=" seconds"
            />
            <Group>
              <Button
                color="orange"
                onClick={() => setPendingAction("shutdown")}
                disabled={
                  submitting !== null ||
                  typeof waitTime !== "number" ||
                  waitTime < 0
                }
              >
                Shutdown Server
              </Button>
              <Button
                color="red"
                variant="filled"
                onClick={() => setPendingAction("stop")}
                disabled={submitting !== null}
              >
                Force Stop Server
              </Button>
            </Group>
            <Alert color="red" title="Force stop is dangerous">
              Force stopping does not save the world first. Unsaved progress may
              be lost.
            </Alert>
          </Stack>
        </Card>
      </Stack>

      <Modal
        opened={pendingAction !== null}
        onClose={() => {
          if (!submitting) {
            setPendingAction(null);
          }
        }}
        title={currentConfirmation?.title}
        centered
        closeOnClickOutside={!submitting}
        closeOnEscape={!submitting}
      >
        <Stack>
          <Text>{currentConfirmation?.description}</Text>
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => setPendingAction(null)}
              disabled={submitting !== null}
            >
              Cancel
            </Button>
            <Button
              color={currentConfirmation?.color}
              onClick={confirmAction}
              loading={submitting === pendingAction}
            >
              {currentConfirmation?.button}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
