import {
  Button,
  Card,
  Container,
  Group,
  Stack,
  Text,
  Title,
} from "@mantine/core";

export default function HomePage() {
  return (
    <Container size="sm" py={80}>
      <Card shadow="md" padding="xl" radius="lg" withBorder>

        <Stack align="center" gap="lg">

          <Title order={1}>
            PalCenter
          </Title>

          <Text c="dimmed">
            Remote Palworld Server Manager
          </Text>

          <Text>
            No servers have been configured.
          </Text>

          <Group>

            <Button size="md">
              Add Server
            </Button>

          </Group>

        </Stack>

      </Card>
    </Container>
  );
}