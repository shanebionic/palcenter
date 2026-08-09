"use client";

import {
  Alert,
  Badge,
  Button,
  Center,
  Group,
  Loader,
  Modal,
  ScrollArea,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  banPlayer,
  getLatestPlayerTelemetry,
  getPlayers,
  kickPlayer,
  getPalDefenderPlayers,
  getPalDefenderProgression,
  getPalDefenderStatus,
  type PalDefenderPlayer,
  type PalDefenderStatus,
} from "../lib/api";
import {
  canonicalPlayerId,
  matchPalDefenderPlayer,
} from "../lib/player-identity";
import type { ConnectedPlayer, PlayerPositionSnapshot } from "../types/servers";
import { SectionCard } from "./ui/SectionCard";
import { SectionHeader } from "./ui/SectionHeader";

type PlayerAction = "kick" | "ban";

interface PendingPlayerAction {
  action: PlayerAction;
  player: ConnectedPlayer;
}

interface ServerPlayersProps {
  serverId: string;
}

const MAX_CONCURRENT_PROGRESSION = 3;

export function ServerPlayers({ serverId }: ServerPlayersProps) {
  const [players, setPlayers] = useState<ConnectedPlayer[]>([]);
  const [telemetry, setTelemetry] = useState<PlayerPositionSnapshot[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingPlayerAction | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [palDefenderStatus, setPalDefenderStatus] =
    useState<PalDefenderStatus | null>(null);
  const [palDefenderPlayers, setPalDefenderPlayers] = useState<
    PalDefenderPlayer[]
  >([]);
  const [enrichedLevels, setEnrichedLevels] = useState<Map<string, number>>(
    new Map(),
  );

  const loadPlayers = useCallback(
    async (background = false) => {
      if (background) {
        setRefreshing(true);
      } else {
        setPlayers([]);
        setTelemetry([]);
        setPalDefenderPlayers([]);
        setPalDefenderStatus(null);
      }

      setError(null);

      try {
        const [connectedPlayers, latestTelemetry] = await Promise.all([
          getPlayers(serverId),
          getLatestPlayerTelemetry(serverId).catch(() => []),
        ]);
        setPlayers(connectedPlayers);
        setTelemetry(latestTelemetry);
        const integration = await getPalDefenderStatus(serverId).catch(
          () => null,
        );
        setPalDefenderStatus(integration);
        setPalDefenderPlayers(
          integration?.connected
            ? await getPalDefenderPlayers(serverId).catch(() => [])
            : [],
        );
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load players.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [serverId],
  );

  useEffect(() => {
    void loadPlayers();
  }, [loadPlayers]);

  const resolveLevel = useCallback(
    (player: ConnectedPlayer): number | null => {
      const enhanced = matchPalDefenderPlayer(player, palDefenderPlayers);
      if (enhanced?.level != null) return enhanced.level;
      const key = canonicalPlayerId(enhanced?.playerId ?? player.playerId);
      const cached = enrichedLevels.get(key);
      if (cached != null) return cached;
      return null;
    },
    [palDefenderPlayers, enrichedLevels],
  );

  const inFlightRef = useRef(new Map<string, Promise<void>>());
  const enrichedRef = useRef(enrichedLevels);

  useEffect(() => {
    enrichedRef.current = enrichedLevels;
  }, [enrichedLevels]);

  useEffect(() => {
    if (!palDefenderStatus?.connected || players.length === 0) return;

    void (async () => {
      const queue: ConnectedPlayer[] = [];

      for (const player of players) {
        const enhanced = matchPalDefenderPlayer(player, palDefenderPlayers);
        if (enhanced?.level != null) continue;
        const key = canonicalPlayerId(enhanced?.playerId ?? player.playerId);
        if (enrichedRef.current.has(key)) continue;

        const existing = inFlightRef.current.get(key);
        if (existing) {
          queue.push(player);
          continue;
        }

        const promise = (async () => {
          try {
            const progression = await getPalDefenderProgression(
              serverId,
              player.playerId,
            );
            setEnrichedLevels((prev) => {
              const next = new Map(prev);
              next.set(key, progression.character.level);
              return next;
            });
          } catch {
            /* one failure does not block the rest */
          } finally {
            inFlightRef.current.delete(key);
          }
        })();

        inFlightRef.current.set(key, promise);
        queue.push(player);
      }

      let idx = 0;
      while (idx < queue.length) {
        const batch: Promise<void>[] = [];
        for (
          let i = 0;
          i < MAX_CONCURRENT_PROGRESSION && idx < queue.length;
          i++, idx++
        ) {
          const player = queue[idx]!;
          const enhanced = matchPalDefenderPlayer(player, palDefenderPlayers);
          const key = canonicalPlayerId(enhanced?.playerId ?? player.playerId);
          batch.push(inFlightRef.current.get(key)!);
        }
        await Promise.all(batch).catch(() => {});
      }
    })();
  }, [palDefenderStatus, palDefenderPlayers, players, serverId]);

  const filteredPlayers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();

    if (!query) {
      return players;
    }

    return players.filter((player) =>
      player.name.toLocaleLowerCase().includes(query),
    );
  }, [players, search]);

  const telemetryByPlayer = useMemo(
    () => new Map(telemetry.map((snapshot) => [snapshot.userId, snapshot])),
    [telemetry],
  );

  const coordinate = (value: number | null) =>
    value === null
      ? "—"
      : new Intl.NumberFormat(undefined, {
          maximumFractionDigits: 1,
        }).format(value);

  const lastUpdated = (capturedAt: string | undefined) => {
    if (!capturedAt) {
      return "Not collected";
    }
    const seconds = Math.max(
      0,
      Math.round((Date.now() - new Date(capturedAt).getTime()) / 1_000),
    );
    if (seconds < 60) {
      return `${seconds} seconds ago`;
    }
    const minutes = Math.round(seconds / 60);
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  };

  const confirmAction = async () => {
    if (!pending) {
      return;
    }

    setSubmitting(true);

    try {
      const result =
        pending.action === "kick"
          ? await kickPlayer(serverId, pending.player.userId)
          : await banPlayer(serverId, pending.player.userId);

      notifications.show({
        color: "green",
        title: "Action completed",
        message: result.message,
      });
      setPending(null);
      await loadPlayers(true);
    } catch (requestError) {
      notifications.show({
        color: "red",
        title: "Action failed",
        message:
          requestError instanceof Error
            ? requestError.message
            : "The player action failed.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Stack gap="lg" pt="lg">
        <SectionHeader
          title="Players"
          description="View and manage players."
          action={
            <Button
              variant="light"
              onClick={() => loadPlayers(true)}
              loading={refreshing}
              disabled={loading || submitting}
            >
              Refresh
            </Button>
          }
        />

        {error && <Alert color="red">{error}</Alert>}

        {palDefenderStatus?.enabled &&
          palDefenderStatus.configured &&
          !palDefenderStatus.connected && (
            <Alert
              color="orange"
              title="Enhanced player management unavailable"
            >
              Native players remain available. PalDefender-backed details and
              actions are temporarily unavailable.
            </Alert>
          )}

        <TextInput
          label="Search players"
          placeholder="Filter by player name"
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
        />

        {loading ? (
          <Center mih={200}>
            <Loader />
          </Center>
        ) : players.length === 0 ? (
          <SectionCard p="xl">
            <Center mih={120}>
              <Stack align="center" gap="xs">
                <Title order={3}>No players online</Title>
                <Text c="dimmed">Connected players will appear here.</Text>
              </Stack>
            </Center>
          </SectionCard>
        ) : filteredPlayers.length === 0 ? (
          <Alert color="gray">No players match your search.</Alert>
        ) : (
          <SectionCard p={0}>
            <ScrollArea>
              <Table striped highlightOnHover miw={900}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Player Name</Table.Th>
                    <Table.Th>Player ID</Table.Th>
                    <Table.Th>Guild</Table.Th>
                    <Table.Th>Level</Table.Th>
                    <Table.Th>Coordinates</Table.Th>
                    <Table.Th>Telemetry Updated</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredPlayers.map((player) => {
                    const snapshot = telemetryByPlayer.get(player.userId);
                    const enhanced = matchPalDefenderPlayer(
                      player,
                      palDefenderPlayers,
                    );
                    const levelValue = resolveLevel(player);
                    return (
                      <Table.Tr key={player.userId}>
                        <Table.Td>
                          <Text
                            component={Link}
                            href={`/servers/${encodeURIComponent(serverId)}/players/${encodeURIComponent(player.playerId)}`}
                            c="cyan.4"
                            fw={600}
                          >
                            {player.name}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text ff="monospace" size="sm">
                            {player.playerId}
                          </Text>
                        </Table.Td>
                        <Table.Td>{enhanced?.guild ?? "—"}</Table.Td>
                        <Table.Td>
                          {levelValue != null ? levelValue : "—"}
                        </Table.Td>
                        <Table.Td>
                          <Text ff="monospace" size="sm">
                            X: {coordinate(snapshot?.x ?? null)} · Y:{" "}
                            {coordinate(snapshot?.y ?? null)}
                            {snapshot?.z !== null && snapshot?.z !== undefined
                              ? ` · Z: ${coordinate(snapshot.z)}`
                              : ""}
                          </Text>
                        </Table.Td>
                        <Table.Td>{lastUpdated(snapshot?.capturedAt)}</Table.Td>
                        <Table.Td>
                          <Badge color="green" variant="light">
                            Online
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs" wrap="nowrap">
                            <Button
                              size="xs"
                              variant="light"
                              color="orange"
                              onClick={() =>
                                setPending({ action: "kick", player })
                              }
                              disabled={submitting}
                            >
                              Kick
                            </Button>
                            <Button
                              size="xs"
                              color="red"
                              onClick={() =>
                                setPending({ action: "ban", player })
                              }
                              disabled={submitting}
                            >
                              Ban
                            </Button>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </SectionCard>
        )}
      </Stack>

      <Modal
        opened={pending !== null}
        onClose={() => {
          if (!submitting) {
            setPending(null);
          }
        }}
        title={`${pending?.action === "ban" ? "Ban" : "Kick"} player?`}
        centered
        closeOnClickOutside={!submitting}
        closeOnEscape={!submitting}
      >
        <Stack>
          <Text>
            {pending?.action === "ban"
              ? `Ban ${pending.player.name} from this server?`
              : `Kick ${pending?.player.name} from this server?`}
          </Text>
          {pending?.action === "ban" && (
            <Alert color="red">
              The player will not be able to reconnect until unbanned.
            </Alert>
          )}
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => setPending(null)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              color={pending?.action === "ban" ? "red" : "orange"}
              onClick={confirmAction}
              loading={submitting}
            >
              {pending?.action === "ban" ? "Ban Player" : "Kick Player"}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
