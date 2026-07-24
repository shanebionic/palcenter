import { Group, Stack, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description: string;
  eyebrow?: string;
  action?: ReactNode;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  action,
}: PageHeaderProps) {
  return (
    <Group justify="space-between" align="flex-end" gap="lg">
      <Stack gap={5}>
        {eyebrow && (
          <Text size="xs" tt="uppercase" fw={700} c="cyan.4" lts={1.4}>
            {eyebrow}
          </Text>
        )}
        <Title order={1}>{title}</Title>
        <Text c="dimmed" maw={680}>
          {description}
        </Text>
      </Stack>
      {action}
    </Group>
  );
}
