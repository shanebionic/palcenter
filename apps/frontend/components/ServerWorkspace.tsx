"use client";

import {
  Alert,
  Loader,
  Skeleton,
  Stack,
  Tabs,
} from "@mantine/core";
import { useCallback, useEffect, useState } from "react";
import { getServer, getSession } from "../lib/api";
import type { ServerWorkspaceData } from "../types/servers";
import { PageHeader } from "./PageHeader";
import { ServerAdministration } from "./ServerAdministration";
import { ServerOverview } from "./ServerOverview";
import { ServerMonitoring } from "./ServerMonitoring";
import { ServerPlayers } from "./ServerPlayers";
import { ServerSettings } from "./ServerSettings";

interface ServerWorkspaceProps {
  serverId: string;
}

export function ServerWorkspace({ serverId }: ServerWorkspaceProps) {
  const [server, setServer] = useState<ServerWorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canOperate, setCanOperate] = useState(false);

  const loadServer = useCallback(
    async (background = false) => {
      if (background) {
        setRefreshing(true);
      }

      setError(null);

      try {
        setServer(await getServer(serverId));
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load the server.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [serverId],
  );

  useEffect(() => {
    void getSession()
      .then((session) => setCanOperate(session.user.role !== "visitor"))
      .catch(() => undefined);
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      await loadServer(true);

      if (!cancelled) {
        timeout = setTimeout(poll, 5_000);
      }
    };

    void loadServer().then(() => {
      if (!cancelled) {
        timeout = setTimeout(poll, 5_000);
      }
    });

    return () => {
      cancelled = true;

      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [loadServer]);

  return (
    <Stack gap="xl">
        {error && <Alert color="red">{error}</Alert>}

        {loading && (
          <Stack gap="md">
            <Skeleton height={110} radius="md" />
            <Skeleton height={360} radius="md" />
          </Stack>
        )}

        {!loading && server && (
          <>
            <PageHeader
              eyebrow="Server Workspace"
              title={server.connection.name}
              description={
                server.status.serverName ??
                "Live operations and server intelligence."
              }
              action={refreshing ? <Loader size="sm" /> : null}
            />

            <Tabs defaultValue="overview" keepMounted={false}>
              <Tabs.List>
                <Tabs.Tab value="overview">Overview</Tabs.Tab>
                {canOperate && <Tabs.Tab value="players">Players</Tabs.Tab>}
                {canOperate && (
                  <Tabs.Tab value="administration">Administration</Tabs.Tab>
                )}
                <Tabs.Tab value="settings">Settings</Tabs.Tab>
                <Tabs.Tab value="monitoring">Monitoring</Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="overview" pt="lg">
                <ServerOverview server={server} />
              </Tabs.Panel>
              {canOperate && (
                <Tabs.Panel value="players">
                  <ServerPlayers serverId={server.connection.id} />
                </Tabs.Panel>
              )}
              {canOperate && (
                <Tabs.Panel value="administration">
                  <ServerAdministration
                    serverId={server.connection.id}
                    serverName={server.connection.name}
                  />
                </Tabs.Panel>
              )}
              <Tabs.Panel value="settings">
                <ServerSettings serverId={server.connection.id} />
              </Tabs.Panel>
              <Tabs.Panel value="monitoring">
                <ServerMonitoring serverId={server.connection.id} />
              </Tabs.Panel>
            </Tabs>
          </>
        )}
    </Stack>
  );
}
