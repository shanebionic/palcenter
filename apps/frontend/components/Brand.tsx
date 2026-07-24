import { Group, Image, Stack, Text } from "@mantine/core";
import Link from "next/link";

interface BrandProps {
  compact?: boolean;
}

export function Brand({ compact = false }: BrandProps) {
  return (
    <Link href="/">
      <Group gap="sm" wrap="nowrap">
        <Image
          src="/assets/palcenter-logo.png"
          alt="PalCenter"
          w={compact ? 38 : 44}
          h={compact ? 38 : 44}
          radius="md"
        />
        {!compact && (
          <Stack gap={0}>
            <Text fw={800} size="lg" lh={1.15}>
              PalCenter
            </Text>
            <Text size="xs" c="dimmed">
              Server Command
            </Text>
          </Stack>
        )}
      </Group>
    </Link>
  );
}
