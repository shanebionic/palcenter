"use client";

import { Button, Group, Modal, Stack, Text, Textarea } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconBroadcast, IconSend } from "@tabler/icons-react";
import { useState } from "react";
import { ApplicationShell } from "../../../components/ApplicationShell";
import { PageHeader } from "../../../components/PageHeader";
import {
  PalDefenderServerSelector,
  usePalDefenderServerSelection,
} from "../../../components/PalDefenderServerSelector";
import { SectionCard } from "../../../components/ui/SectionCard";
import { broadcastPalDefenderMessage } from "../../../lib/api";
import {
  broadcastCharacterCount,
  broadcastValidationError,
} from "../../../lib/paldefender-broadcast";

export default function PalDefenderBroadcastPage() {
  const selection = usePalDefenderServerSelection();
  const [message, setMessage] = useState("");
  const [validationError, setValidationError] = useState("");
  const [confirmationOpened, setConfirmationOpened] = useState(false);
  const [sending, setSending] = useState(false);
  const characterCount = broadcastCharacterCount(message);

  const confirm = () => {
    const error = broadcastValidationError(message);
    if (error) {
      setValidationError(error);
      return;
    }
    setValidationError("");
    setConfirmationOpened(true);
  };

  const send = async () => {
    if (sending) return;
    setSending(true);
    try {
      if (!selection.selectedServerId) return;
      await broadcastPalDefenderMessage(selection.selectedServerId, message);
      setConfirmationOpened(false);
      setMessage("");
      notifications.show({
        color: "green",
        title: "Broadcast sent",
        message: "PalDefender sent the message to connected players.",
      });
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Unable to send broadcast",
        message:
          error instanceof Error
            ? error.message
            : "PalDefender could not send the broadcast.",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <ApplicationShell>
      <Stack gap="xl">
        <PageHeader
          eyebrow="PalDefender"
          title="Broadcast"
          description="Send a chat-style message to every player currently connected to the server."
        />
        <PalDefenderServerSelector selection={selection} />
        <SectionCard>
          <Stack gap="md">
            <Textarea
              label="Message"
              description="PalDefender does not document a maximum message length."
              placeholder="Enter a server-wide message"
              minRows={6}
              autosize
              value={message}
              onChange={(event) => {
                setMessage(event.currentTarget.value);
                if (validationError) setValidationError("");
              }}
              error={validationError}
              disabled={sending}
            />
            <Group justify="space-between" align="center">
              <Text size="sm" c="dimmed">
                {characterCount} character{characterCount === 1 ? "" : "s"}
              </Text>
              <Button
                leftSection={<IconBroadcast size={18} />}
                onClick={confirm}
                disabled={sending || !selection.selectedServerId}
              >
                Send Broadcast
              </Button>
            </Group>
          </Stack>
        </SectionCard>
      </Stack>
      <Modal
        opened={confirmationOpened}
        onClose={() => {
          if (!sending) setConfirmationOpened(false);
        }}
        title="Send Broadcast"
        centered
        closeOnClickOutside={!sending}
        closeOnEscape={!sending}
      >
        <Stack>
          <Text c="dimmed">
            This message will be sent to every connected player.
          </Text>
          <Text
            p="md"
            bg="dark.7"
            style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
          >
            {message}
          </Text>
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => setConfirmationOpened(false)}
              disabled={sending}
            >
              Cancel
            </Button>
            <Button
              leftSection={<IconSend size={18} />}
              loading={sending}
              disabled={sending}
              onClick={() => void send()}
            >
              Send Broadcast
            </Button>
          </Group>
        </Stack>
      </Modal>
    </ApplicationShell>
  );
}
