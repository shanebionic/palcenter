"use client";

import { Alert, Button, SimpleGrid, Stack } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconPlus } from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import { AddServerDialog } from "../../components/AddServerDialog";
import { ApplicationShell } from "../../components/ApplicationShell";
import { BrandedLoader } from "../../components/BrandedLoader";
import { EmptyState } from "../../components/EmptyState";
import { PageHeader } from "../../components/PageHeader";
import { ServerCard } from "../../components/ServerCard";
import { getServerStatus, getSession, type AuthSession } from "../../lib/api";
import type { ServerStatus } from "../../types/servers";

export default function ServersPage() {
  const [dialogOpened, dialog] = useDisclosure(false);
  const [servers, setServers] = useState<ServerStatus[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);

  const loadServers = useCallback(async () => {
    setError(null);
    try {
      setServers(await getServerStatus());
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load servers.",
      );
    }
  }, []);

  useEffect(() => {
    void loadServers();
  }, [loadServers]);

  useEffect(() => {
    void getSession()
      .then(setSession)
      .catch(() => setSession(null));
  }, []);

  const isAdministrator = session?.user.role === "administrator";

  return (
    <ApplicationShell>
      <Stack gap="xl">
        <PageHeader
          eyebrow="Server Fleet"
          title="Servers"
          description="Open a configured Palworld server for live status, immediate actions, players, and settings."
          action={
            isAdministrator ? (
              <Button
                leftSection={<IconPlus size={18} />}
                onClick={dialog.open}
              >
                Add Server
              </Button>
            ) : null
          }
        />
        {error && <Alert color="red">{error}</Alert>}
        {!servers ? (
          <BrandedLoader message="Loading configured servers" />
        ) : servers.length === 0 ? (
          <EmptyState onAddServer={isAdministrator ? dialog.open : undefined} />
        ) : (
          <SimpleGrid cols={{ base: 1, lg: 2 }}>
            {servers.map((server) => (
              <ServerCard key={server.id} server={server} />
            ))}
          </SimpleGrid>
        )}
      </Stack>

      <AddServerDialog
        opened={dialogOpened}
        onClose={dialog.close}
        onSaved={() => loadServers()}
      />
    </ApplicationShell>
  );
}
