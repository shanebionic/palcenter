import { Group, Text, ThemeIcon } from "@mantine/core";
import type { ReactNode } from "react";
import { SectionCard } from "./SectionCard";

interface StatCardProps {
  label: string;
  value: string;
  icon: ReactNode;
  color?: string;
  compact?: boolean;
  lineClamp?: number;
}

export function StatCard({
  label,
  value,
  icon,
  color = "cyan",
  compact = false,
  lineClamp,
}: StatCardProps) {
  return (
    <SectionCard className="pc-stat-card" p="lg">
      <Group justify="space-between" wrap="nowrap">
        <div className="pc-stat-card-content">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700} lts={1}>
            {label}
          </Text>
          <Text
            className="pc-stat-card-value"
            size={compact ? "sm" : "xl"}
            fw={750}
            mt={4}
            lineClamp={lineClamp}
          >
            {value}
          </Text>
        </div>
        <ThemeIcon
          className="pc-stat-card-icon"
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
