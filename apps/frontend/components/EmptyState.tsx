"use client";

import { Button, Card, Image, Stack, Text, Title } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";

interface EmptyStateProps {
  onAddServer?: () => void;
}

export function EmptyState({ onAddServer }: EmptyStateProps) {
  return (
    <Card className="pc-panel" withBorder radius="xl" py={64} px="xl">
      <Stack align="center" gap="md">
        <Image
          src="/assets/palcenter-logo.png"
          alt="PalCenter"
          w={112}
          h={112}
          radius="xl"
        />
        <Title order={2} ta="center">
          Your command center is ready
        </Title>
        <Text c="dimmed" ta="center" maw={520}>
          Connect your first remote Palworld server to monitor health, players,
          and operations from PalCenter.
        </Text>
        {onAddServer && (
          <Button
            mt="sm"
            size="md"
            leftSection={<IconPlus size={18} />}
            onClick={onAddServer}
          >
            Add Your First Server
          </Button>
        )}
      </Stack>
    </Card>
  );
}
