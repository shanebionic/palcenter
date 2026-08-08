"use client";

import { Alert, Select, Stack, Text } from "@mantine/core";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getServers } from "../lib/api";
import type { PublicConnection } from "../types/servers";

export function usePalDefenderServerSelection() {
  const router = useRouter();
  const pathname = usePathname();
  const [servers, setServers] = useState<PublicConnection[]>([]);
  const [requestedId, setRequestedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    setRequestedId(
      new URLSearchParams(window.location.search).get("serverId") ?? "",
    );
    void getServers()
      .then(setServers)
      .catch((value: unknown) =>
        setError(
          value instanceof Error ? value.message : "Unable to load servers.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const selected = useMemo(
    () => servers.find((server) => server.id === requestedId) ?? null,
    [requestedId, servers],
  );

  const select = (serverId: string | null) => {
    setRequestedId(serverId ?? "");
    const query = serverId ? `?serverId=${encodeURIComponent(serverId)}` : "";
    router.push(`${pathname}${query}`);
  };

  return {
    servers,
    selected,
    selectedServerId:
      selected?.palDefender.enabled &&
      selected.palDefender.endpoint &&
      selected.palDefender.tokenConfigured
        ? selected.id
        : "",
    select,
    loading,
    error,
  };
}

export function PalDefenderServerSelector({
  selection,
}: {
  selection: ReturnType<typeof usePalDefenderServerSelection>;
}) {
  return (
    <Stack gap="sm">
      <Select
        label="PalCenter server"
        description="Every PalDefender request uses only this server’s saved integration."
        placeholder={selection.loading ? "Loading servers" : "Select a server"}
        searchable
        value={selection.selected?.id ?? null}
        data={selection.servers.map((server) => ({
          value: server.id,
          label: server.name,
        }))}
        onChange={selection.select}
        disabled={selection.loading}
        maw={440}
      />
      {selection.error && <Alert color="red">{selection.error}</Alert>}
      {selection.selected && !selection.selected.palDefender.enabled && (
        <Alert color="blue" title="PalDefender disabled">
          Enable and configure PalDefender in this server’s Connection Settings.
        </Alert>
      )}
      {selection.selected?.palDefender.enabled &&
        (!selection.selected.palDefender.endpoint ||
          !selection.selected.palDefender.tokenConfigured) && (
          <Alert color="orange" title="Configuration required">
            Add both a PalDefender endpoint and bearer token in this server’s
            Connection Settings.
          </Alert>
        )}
      {!selection.loading && !selection.selected && (
        <Text c="dimmed">Select a server to view its PalDefender data.</Text>
      )}
    </Stack>
  );
}
