"use client";

import { Alert, SimpleGrid, Stack } from "@mantine/core";
import { useEffect, useState } from "react";
import { ApplicationShell } from "../../components/ApplicationShell";
import { BrandedLoader } from "../../components/BrandedLoader";
import { PageHeader } from "../../components/PageHeader";
import { ServerCard } from "../../components/ServerCard";
import { getServerStatus } from "../../lib/api";
import type { ServerStatus } from "../../types/servers";

export default function ServersPage() {
  const [servers, setServers] = useState<ServerStatus[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getServerStatus()
      .then(setServers)
      .catch((value) =>
        setError(
          value instanceof Error ? value.message : "Unable to load servers.",
        ),
      );
  }, []);

  return (
    <ApplicationShell>
      <Stack gap="xl">
        <PageHeader
          eyebrow="Server Fleet"
          title="Servers"
          description="Open a configured Palworld server for live status, immediate actions, players, and settings."
        />
        {error && <Alert color="red">{error}</Alert>}
        {!servers ? (
          <BrandedLoader message="Loading configured servers" />
        ) : (
          <SimpleGrid cols={{ base: 1, lg: 2 }}>
            {servers.map((server) => (
              <ServerCard key={server.id} server={server} />
            ))}
          </SimpleGrid>
        )}
      </Stack>
    </ApplicationShell>
  );
}
