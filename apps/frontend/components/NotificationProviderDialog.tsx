"use client";

import {
  Alert,
  Button,
  Checkbox,
  Group,
  Modal,
  PasswordInput,
  Select,
  Stack,
  Switch,
  TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useState } from "react";
import { createNotification, updateNotification } from "../lib/api";
import type {
  NotificationConfiguration,
  NotificationConfigurationInput,
  NotificationConfigurationUpdate,
  ServerEventType,
} from "../types/servers";

const eventOptions: { value: ServerEventType; label: string }[] = [
  { value: "server_offline", label: "Server went offline" },
  { value: "server_online", label: "Server came online" },
  { value: "server_restarted", label: "Server restarted" },
  { value: "player_joined", label: "Player joined" },
  { value: "player_left", label: "Player left" },
  { value: "player_banned", label: "Player banned" },
];

interface FormValues {
  type: "discord" | "ntfy";
  name: string;
  enabled: boolean;
  events: ServerEventType[];
  webhookUrl: string;
  serverUrl: string;
  topic: string;
}

interface NotificationProviderDialogProps {
  opened: boolean;
  provider: NotificationConfiguration | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

const initialValues: FormValues = {
  type: "discord",
  name: "",
  enabled: true,
  events: eventOptions.map((event) => event.value),
  webhookUrl: "",
  serverUrl: "https://ntfy.sh",
  topic: "",
};

function valuesForProvider(
  provider: NotificationConfiguration | null,
): FormValues {
  if (!provider) {
    return initialValues;
  }

  return {
    type: provider.type,
    name: provider.name,
    enabled: provider.enabled,
    events: provider.events,
    webhookUrl: "",
    serverUrl:
      provider.type === "ntfy" ? provider.serverUrl : "https://ntfy.sh",
    topic: provider.type === "ntfy" ? provider.topic : "",
  };
}

function validHttpUrl(value: string): boolean {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export function NotificationProviderDialog({
  opened,
  provider,
  onClose,
  onSaved,
}: NotificationProviderDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const form = useForm<FormValues>({
    initialValues: valuesForProvider(provider),
    validate: {
      name: (value) => (value.trim() ? null : "Name is required."),
      events: (value) =>
        value.length > 0 ? null : "Select at least one event.",
      webhookUrl: (value, values) => {
        if (values.type !== "discord") {
          return null;
        }

        if (!value && provider?.type === "discord") {
          return null;
        }

        return validHttpUrl(value) ? null : "Enter a valid webhook URL.";
      },
      serverUrl: (value, values) =>
        values.type !== "ntfy" || validHttpUrl(value)
          ? null
          : "Enter a valid ntfy server URL.",
      topic: (value, values) =>
        values.type !== "ntfy" || value.trim() ? null : "Topic is required.",
    },
  });

  const submit = form.onSubmit(async (values) => {
    setSaving(true);
    setError(null);

    try {
      const common = {
        name: values.name.trim(),
        enabled: values.enabled,
        events: values.events,
      };

      if (provider) {
        const input: NotificationConfigurationUpdate =
          values.type === "discord"
            ? {
                ...common,
                type: "discord",
                ...(values.webhookUrl
                  ? { webhookUrl: values.webhookUrl.trim() }
                  : {}),
              }
            : {
                ...common,
                type: "ntfy",
                serverUrl: values.serverUrl.trim(),
                topic: values.topic.trim(),
              };
        await updateNotification(provider.id, input);
      } else {
        const input: NotificationConfigurationInput =
          values.type === "discord"
            ? {
                ...common,
                type: "discord",
                webhookUrl: values.webhookUrl.trim(),
              }
            : {
                ...common,
                type: "ntfy",
                serverUrl: values.serverUrl.trim(),
                topic: values.topic.trim(),
              };
        await createNotification(input);
      }

      await onSaved();
      onClose();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to save the notification provider.",
      );
    } finally {
      setSaving(false);
    }
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        provider ? "Edit notification provider" : "Add notification provider"
      }
      closeOnClickOutside={!saving}
      closeOnEscape={!saving}
    >
      <form onSubmit={submit}>
        <Stack>
          <Select
            label="Provider"
            data={[
              { value: "discord", label: "Discord webhook" },
              { value: "ntfy", label: "ntfy" },
            ]}
            allowDeselect={false}
            {...form.getInputProps("type")}
          />
          <TextInput
            label="Display Name"
            placeholder="Operations alerts"
            required
            {...form.getInputProps("name")}
          />
          <Switch
            label="Enabled"
            description="Send notifications for selected events."
            {...form.getInputProps("enabled", { type: "checkbox" })}
          />

          {form.values.type === "discord" ? (
            <PasswordInput
              label="Webhook URL"
              placeholder={
                provider?.type === "discord"
                  ? "Leave blank to keep the current webhook"
                  : "https://discord.com/api/webhooks/..."
              }
              required={provider?.type !== "discord"}
              description="Webhook credentials are stored by the API and never returned to the browser."
              {...form.getInputProps("webhookUrl")}
            />
          ) : (
            <>
              <TextInput
                label="ntfy Server URL"
                placeholder="https://ntfy.sh"
                required
                {...form.getInputProps("serverUrl")}
              />
              <TextInput
                label="Topic"
                placeholder="palcenter-alerts"
                required
                {...form.getInputProps("topic")}
              />
            </>
          )}

          <Checkbox.Group
            label="Notification Events"
            description="Choose which events this provider receives."
            {...form.getInputProps("events")}
          >
            <Stack gap="xs" mt="xs">
              {eventOptions.map((event) => (
                <Checkbox
                  key={event.value}
                  value={event.value}
                  label={event.label}
                />
              ))}
            </Stack>
          </Checkbox.Group>

          {error && <Alert color="red">{error}</Alert>}

          <Group justify="flex-end">
            <Button variant="subtle" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Save
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
