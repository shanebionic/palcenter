"use client";

import { Button, Card, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { IconArrowRight, IconUsers } from "@tabler/icons-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ApplicationShell } from "../../components/ApplicationShell";
import { BrandedLoader } from "../../components/BrandedLoader";
import { PageHeader } from "../../components/PageHeader";
import { getServers } from "../../lib/api";
import type { PublicConnection } from "../../types/servers";

export default function PlayersPage() {
  const [servers, setServers] = useState<PublicConnection[] | null>(null);

  useEffect(() => {
    void getServers().then(setServers);
  }, []);

  return (
    <ApplicationShell>
      <Stack gap="xl">
        <PageHeader
          eyebrow="Player Operations"
          title="Players"
          description="Choose a server to view connected players and perform authorized player actions."
        />
        {!servers ? (
          <BrandedLoader message="Loading player destinations" />
        ) : (
          <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }}>
            {servers.map((server) => (
              <Card key={server.id} className="pc-panel" withBorder radius="lg">
                <Group justify="space-between">
                  <div>
                    <Text fw={700}>{server.name}</Text>
                    <Text size="sm" c="dimmed">
                      Connected player management
                    </Text>
                  </div>
                  <Button
                    component={Link}
                    href={`/servers/${server.id}`}
                    variant="light"
                    rightSection={<IconArrowRight size={16} />}
                    leftSection={<IconUsers size={16} />}
                  >
                    Open
                  </Button>
                </Group>
              </Card>
            ))}
          </SimpleGrid>
        )}
      </Stack>
    </ApplicationShell>
  );
}
