import { Button, Card, Container, Stack, Text, Title } from "@mantine/core";
import Link from "next/link";

interface ServerPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ServerPage({ params }: ServerPageProps) {
  const { id } = await params;

  return (
    <Container size="sm" py={80}>
      <Card withBorder shadow="sm" radius="md" p="xl">
        <Stack gap="md">
          <Title order={1}>Server Management</Title>
          <Text c="dimmed">
            Management controls for {id} will be added in a future issue.
          </Text>
          <Button component={Link} href="/" variant="light">
            Back to Dashboard
          </Button>
        </Stack>
      </Card>
    </Container>
  );
}
