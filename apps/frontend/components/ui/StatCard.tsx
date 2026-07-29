import { Group, Text, ThemeIcon } from "@mantine/core";
import type { ReactNode } from "react";
import { SectionCard } from "./SectionCard";

interface StatCardProps {
  label: string;
  value: string;
  icon: ReactNode;
  color?: string;
  compact?: boolean;
}

export function StatCard({
  label,
  value,
  icon,
  color = "cyan",
  compact = false,
}: StatCardProps) {
  return (
    <SectionCard p="lg">
      <Group justify="space-between" wrap="nowrap">
        <div>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700} lts={1}>
            {label}
          </Text>
          <Text size={compact ? "sm" : "xl"} fw={750} mt={4} lineClamp={2}>
            {value}
          </Text>
        </div>
        <ThemeIcon
          size="xl"
          radius="xl"
          color={color}
          variant="light"
          aria-hidden
        >
          {icon}
        </ThemeIcon>
      </Group>
    </SectionCard>
  );
}
