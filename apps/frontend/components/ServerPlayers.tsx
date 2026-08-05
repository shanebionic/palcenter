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
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  banPlayer,
  getLatestPlayerTelemetry,
  getPlayers,
  kickPlayer,
  getCompanionStatus,
  teleportPlayer,
} from "../lib/api";
import type { ConnectedPlayer, PlayerPositionSnapshot } from "../types/servers";
import type { CompanionStatus } from "../types/companion";
import { supportsMapTeleport } from "../lib/teleport";
import { SectionCard } from "./ui/SectionCard";
import { SectionHeader } from "./ui/SectionHeader";

type PlayerAction = "kick" | "ban";
type TeleportAction = "admin-to-player" | "player-to-admin";

interface PendingPlayerAction {
  action: PlayerAction;
  player: ConnectedPlayer;
}

interface ServerPlayersProps {
  serverId: string;
  onSendToMapLocation(playerId: string): void;
}

export function ServerPlayers({
  serverId,
  onSendToMapLocation,
}: ServerPlayersProps) {
  const [players, setPlayers] = useState<ConnectedPlayer[]>([]);
  const [telemetry, setTelemetry] = useState<PlayerPositionSnapshot[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingPlayerAction | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [companion, setCompanion] = useState<CompanionStatus | null>(null);
  const [pendingTeleport, setPendingTeleport] = useState<{
    action: TeleportAction;
    player: ConnectedPlayer;
  } | null>(null);

  const loadPlayers = useCallback(
    async (background = false) => {
      if (background) {
        setRefreshing(true);
      }

      setError(null);

      try {
        const [connectedPlayers, latestTelemetry] = await Promise.all([
          getPlayers(serverId),
          getLatestPlayerTelemetry(serverId).catch(() => []),
        ]);
        setPlayers(connectedPlayers);
        setTelemetry(latestTelemetry);
        setCompanion(await getCompanionStatus(serverId).catch(() => null));
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
  const administratorOnline = players.some(
    (player) => player.playerId === companion?.administratorPlayerId,
  );
  const teleportSupported = (action: TeleportAction) =>
    companion?.state === "connected" &&
    companion.adminActions?.[
      action === "admin-to-player"
        ? "teleportAdminToPlayer"
        : "teleportPlayerToAdmin"
    ] === true;
  const mapTeleportSupported = supportsMapTeleport(companion);
  const confirmTeleport = async () => {
    if (!pendingTeleport || submitting) return;
    setSubmitting(true);
    try {
      const requestId = `pc-${crypto.randomUUID()}`;
      const result = await teleportPlayer(serverId, pendingTeleport.action, {
        requestId,
        targetPlayerId: pendingTeleport.player.playerId,
      });
      notifications.show({
        color: result.status === "succeeded" ? "green" : "red",
        title:
          result.status === "succeeded"
            ? "Teleport completed"
            : "Teleport rejected",
        message: result.message,
      });
      if (result.status === "succeeded") await loadPlayers(true);
      setPendingTeleport(null);
    } catch (error) {
      notifications.show({
        color: "orange",
        title: "Teleport result uncertain",
        message:
          error instanceof Error
            ? `${error.message} Verify the player's location before trying again.`
            : "Verify the player's location before trying again.",
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
          description="View and manage connected players."
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
              <Table striped highlightOnHover miw={960}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Player Name</Table.Th>
                    <Table.Th>Player ID</Table.Th>
                    <Table.Th>IP Address</Table.Th>
                    <Table.Th>Coordinates</Table.Th>
                    <Table.Th>Telemetry Updated</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredPlayers.map((player) => {
                    const snapshot = telemetryByPlayer.get(player.userId);
                    return (
                      <Table.Tr key={player.userId}>
                        <Table.Td>{player.name}</Table.Td>
                        <Table.Td>
                          <Text ff="monospace" size="sm">
                            {player.playerId}
                          </Text>
                        </Table.Td>
                        <Table.Td>{player.ip ?? "Unavailable"}</Table.Td>
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
                            {teleportSupported("admin-to-player") && (
                              <Button
                                size="xs"
                                variant="light"
                                color="violet"
                                onClick={() =>
                                  setPendingTeleport({
                                    action: "admin-to-player",
                                    player,
                                  })
                                }
                                disabled={submitting || !administratorOnline}
                              >
                                Go to player
                              </Button>
                            )}
                            {teleportSupported("player-to-admin") && (
                              <Button
                                size="xs"
                                variant="light"
                                color="violet"
                                onClick={() =>
                                  setPendingTeleport({
                                    action: "player-to-admin",
                                    player,
                                  })
                                }
                                disabled={submitting || !administratorOnline}
                              >
                                Bring player to me
                              </Button>
                            )}
                            {mapTeleportSupported && (
                              <Button
                                size="xs"
                                variant="light"
                                color="violet"
                                onClick={() =>
                                  onSendToMapLocation(player.playerId)
                                }
                                disabled={submitting || !administratorOnline}
                              >
                                Send to map location
                              </Button>
                            )}
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
      <Modal
        opened={pendingTeleport !== null}
        onClose={() => !submitting && setPendingTeleport(null)}
        title="Confirm teleport"
        centered
        closeOnClickOutside={!submitting}
        closeOnEscape={!submitting}
      >
        <Stack>
          <Alert color="violet">
            {pendingTeleport?.action === "admin-to-player"
              ? `Move your configured administrator character to ${pendingTeleport.player.name}.`
              : `Move ${pendingTeleport?.player.name} to your configured administrator character.`}{" "}
            This uses the Companion’s live player location and coordinate space.
          </Alert>
          <Text size="sm">
            The selected player must remain online. A unique request ID will be
            used and this request will not be retried automatically.
          </Text>
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => setPendingTeleport(null)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              color="violet"
              onClick={confirmTeleport}
              loading={submitting}
            >
              Confirm teleport
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
