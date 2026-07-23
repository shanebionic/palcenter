import {
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { notificationEventLabel } from "../lib/notification-events";
import type { NotificationConfiguration } from "../types/servers";

interface NotificationProviderCardProps {
  provider: NotificationConfiguration;
  busy: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onTest: () => void;
}

export function NotificationProviderCard({
  provider,
  busy,
  onEdit,
  onToggle,
  onDelete,
  onTest,
}: NotificationProviderCardProps) {
  return (
    <Card withBorder radius="md" p="lg">
      <Stack h="100%">
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={3}>{provider.name}</Title>
            <Text c="dimmed">
              {provider.type === "discord" ? "Discord webhook" : "ntfy"}
            </Text>
          </div>
          <Badge color={provider.enabled ? "green" : "gray"} variant="light">
            {provider.enabled ? "Enabled" : "Disabled"}
          </Badge>
        </Group>

        {provider.type === "discord" ? (
          <Group gap="xs">
            <Text size="sm">Webhook</Text>
            <Badge
              color={provider.webhookConfigured ? "green" : "red"}
              variant="dot"
            >
              {provider.webhookConfigured ? "Configured" : "Not configured"}
            </Badge>
          </Group>
        ) : (
          <Stack gap={2}>
            <Text size="sm" fw={500}>
              Server
            </Text>
            <Text size="sm" c="dimmed">
              {provider.serverUrl}
            </Text>
            <Text size="sm" fw={500} mt="xs">
              Topic
            </Text>
            <Text size="sm" c="dimmed">
              {provider.topic}
            </Text>
          </Stack>
        )}

        <Stack gap="xs">
          <Text size="sm" fw={500}>
            Events
          </Text>
          <Group gap="xs">
            {provider.events.map((event) => (
              <Badge key={event} variant="outline" color="gray">
                {notificationEventLabel(event)}
              </Badge>
            ))}
          </Group>
        </Stack>

        <Group mt="auto">
          <Button size="xs" variant="light" onClick={onTest} disabled={busy}>
            {busy ? <Loader size="xs" /> : "Send Test"}
          </Button>
          <Button size="xs" variant="default" onClick={onEdit} disabled={busy}>
            Edit
          </Button>
          <Button size="xs" variant="subtle" onClick={onToggle} disabled={busy}>
            {provider.enabled ? "Disable" : "Enable"}
          </Button>
          <Button
            size="xs"
            color="red"
            variant="subtle"
            onClick={onDelete}
            disabled={busy}
          >
            Delete
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
