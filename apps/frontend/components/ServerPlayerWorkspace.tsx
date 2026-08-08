"use client";

import {
  Alert,
  Button,
  Center,
  Loader,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Title,
} from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getPalDefenderPlayers,
  getPalDefenderStatus,
  getPlayers,
  type PalDefenderStatus,
} from "../lib/api";
import {
  canonicalPlayerId,
  matchPalDefenderPlayer,
} from "../lib/player-identity";
import type { ConnectedPlayer } from "../types/servers";
import { ApplicationShell } from "./ApplicationShell";
import { PalDefenderPlayerWorkspace } from "./PalDefenderPlayerWorkspace";
import { SectionCard } from "./ui/SectionCard";

export function ServerPlayerWorkspace({
  serverId,
  playerId,
}: {
  serverId: string;
  playerId: string;
}) {
  const [nativePlayer, setNativePlayer] = useState<ConnectedPlayer | null>(
    null,
  );
  const [status, setStatus] = useState<PalDefenderStatus | null>(null);
  const [palDefenderPlayerId, setPalDefenderPlayerId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const nativePlayers = await getPlayers(serverId);
        const native =
          nativePlayers.find(
            (candidate) =>
              canonicalPlayerId(candidate.playerId) ===
              canonicalPlayerId(playerId),
          ) ?? null;
        if (cancelled) return;
        setNativePlayer(native);

        const integration = await getPalDefenderStatus(serverId);
        if (cancelled) return;
        setStatus(integration);
        if (integration.connected) {
          const enhancedPlayers = await getPalDefenderPlayers(serverId);
          const enhanced = native
            ? matchPalDefenderPlayer(native, enhancedPlayers)
            : enhancedPlayers.find(
                (candidate) =>
                  canonicalPlayerId(candidate.playerId) ===
                  canonicalPlayerId(playerId),
              );
          if (!cancelled) setPalDefenderPlayerId(enhanced?.playerId ?? "");
        }
      } catch (value) {
        if (!cancelled)
          setError(
            value instanceof Error
              ? value.message
              : "Unable to load this player.",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [playerId, serverId]);

  const backHref = `/servers/${encodeURIComponent(serverId)}/players`;
  if (!loading && status?.connected && palDefenderPlayerId) {
    return (
      <PalDefenderPlayerWorkspace
        serverId={serverId}
        playerId={palDefenderPlayerId}
        backHref={backHref}
      />
    );
  }

  const unavailableMessage =
    status?.state === "authentication_failed"
      ? "PalDefender authentication failed. Update this server’s bearer token; native player information remains available."
      : status?.state === "invalid_response"
        ? "PalDefender returned an incompatible response. Native player information remains available."
        : status?.state === "unreachable"
          ? "PalDefender is temporarily unreachable. Native player information remains available."
          : status?.state === "configuration_required"
            ? "Complete the PalDefender connection settings to enable Inventory, Pals, Technology, and enhanced actions."
            : status?.state === "disabled"
              ? "Enable PalDefender for this server to add Inventory, Pals, Technology, and enhanced actions."
              : "Enhanced player management is unavailable.";

  return (
    <ApplicationShell>
      <Stack gap="xl">
        <Button
          component={Link}
          href={backHref}
          variant="subtle"
          leftSection={<IconArrowLeft size={18} />}
          w="fit-content"
        >
          Back to Players
        </Button>
        {loading ? (
          <Center mih={320}>
            <Loader />
          </Center>
        ) : (
          <>
            <Stack gap="xs">
              <Text size="xs" tt="uppercase" fw={700} c="cyan.4">
                Player Workspace
              </Text>
              <Title order={1}>{nativePlayer?.name ?? "Player"}</Title>
              <Text ff="monospace" c="dimmed">
                {nativePlayer?.playerId ?? playerId}
              </Text>
            </Stack>
            {error && <Alert color="red">{error}</Alert>}
            <Alert
              color={status?.enabled ? "orange" : "blue"}
              title="Enhanced player management unavailable"
            >
              {unavailableMessage}
            </Alert>
            <Tabs defaultValue="overview">
              <Tabs.List>
                <Tabs.Tab value="overview">Overview</Tabs.Tab>
                <Tabs.Tab value="inventory">Inventory</Tabs.Tab>
                <Tabs.Tab value="pals">Pals</Tabs.Tab>
                <Tabs.Tab value="technology">Technology</Tabs.Tab>
                <Tabs.Tab value="actions">Actions</Tabs.Tab>
              </Tabs.List>
              <Tabs.Panel value="overview" pt="lg">
                <SectionCard>
                  <SimpleGrid cols={{ base: 1, sm: 3 }}>
                    <Stack gap={2}>
                      <Text size="xs" c="dimmed" tt="uppercase">
                        Name
                      </Text>
                      <Text>{nativePlayer?.name ?? "—"}</Text>
                    </Stack>
                    <Stack gap={2}>
                      <Text size="xs" c="dimmed" tt="uppercase">
                        Player ID
                      </Text>
                      <Text ff="monospace">
                        {nativePlayer?.playerId ?? playerId}
                      </Text>
                    </Stack>
                    <Stack gap={2}>
                      <Text size="xs" c="dimmed" tt="uppercase">
                        Status
                      </Text>
                      <Text>
                        {nativePlayer ? "Online" : "Offline or unavailable"}
                      </Text>
                    </Stack>
                  </SimpleGrid>
                </SectionCard>
              </Tabs.Panel>
              {(["inventory", "pals", "technology", "actions"] as const).map(
                (tab) => (
                  <Tabs.Panel key={tab} value={tab} pt="lg">
                    <Alert color="gray">{unavailableMessage}</Alert>
                  </Tabs.Panel>
                ),
              )}
            </Tabs>
          </>
        )}
      </Stack>
    </ApplicationShell>
  );
}
