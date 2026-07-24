import { Center, Image, Loader, Stack, Text } from "@mantine/core";

interface BrandedLoaderProps {
  message?: string;
}

export function BrandedLoader({
  message = "Connecting to your command center",
}: BrandedLoaderProps) {
  return (
    <Center mih={320}>
      <Stack align="center" gap="md">
        <Image
          src="/assets/palcenter-logo.png"
          alt=""
          w={72}
          h={72}
          radius="xl"
          opacity={0.9}
        />
        <Loader type="dots" />
        <Text size="sm" c="dimmed">
          {message}
        </Text>
      </Stack>
    </Center>
  );
}
