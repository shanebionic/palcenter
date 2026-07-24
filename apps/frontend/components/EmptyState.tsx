"use client";

import { Button, Card, Stack, Text, Title } from "@mantine/core";

interface EmptyStateProps {
  onAddServer?: () => void;
}

export function EmptyState({ onAddServer }: EmptyStateProps) {
  return (
    <Card withBorder shadow="md" radius="md" p="xl">
      <Stack align="center" gap="md">
        <Title order={2}>Welcome to PalCenter</Title>

        <Text c="dimmed" ta="center">
          No Palworld servers have been configured yet.
        </Text>

        {onAddServer && <Button onClick={onAddServer}>Add Server</Button>}
      </Stack>
    </Card>
  );
}
