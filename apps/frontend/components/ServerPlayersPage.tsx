"use client";

import { Alert, Loader, Stack } from "@mantine/core";
import { useEffect, useState } from "react";
import { getServer } from "../lib/api";
import type { ServerWorkspaceData } from "../types/servers";
import { ApplicationShell } from "./ApplicationShell";
import { PageHeader } from "./PageHeader";
import { ServerPlayers } from "./ServerPlayers";

export function ServerPlayersPage({ serverId }: { serverId: string }) {
  const [server, setServer] = useState<ServerWorkspaceData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void getServer(serverId)
      .then(setServer)
      .catch((value: unknown) =>
        setError(
          value instanceof Error ? value.message : "Unable to load the server.",
        ),
      );
  }, [serverId]);

  return (
    <ApplicationShell>
      <Stack gap="xl">
        {error && <Alert color="red">{error}</Alert>}
        {!server && !error && <Loader />}
        {server && (
          <>
            <PageHeader
              eyebrow="Server Workspace · Players"
              title={server.connection.name}
              description="One player-management workspace, enhanced by the capabilities configured for this server."
            />
            <ServerPlayers
              serverId={serverId}
              onSendToMapLocation={() => undefined}
            />
          </>
        )}
      </Stack>
    </ApplicationShell>
  );
}
