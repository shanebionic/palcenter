import { Group, Stack, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";

interface SectionHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function SectionHeader({
  title,
  description,
  action,
}: SectionHeaderProps) {
  return (
    <Group
      className="pc-section-header"
      justify="space-between"
      align="flex-end"
      gap="md"
    >
      <Stack gap={3}>
        <Title order={2}>{title}</Title>
        {description && (
          <Text c="dimmed" size="sm" maw={720}>
            {description}
          </Text>
        )}
      </Stack>
      {action}
    </Group>
  );
}
