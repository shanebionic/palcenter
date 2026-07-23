"use client";

import {
  Alert,
  Badge,
  Button,
  Card,
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
import { banPlayer, getPlayers, kickPlayer } from "../lib/api";
import type { ConnectedPlayer } from "../types/servers";

type PlayerAction = "kick" | "ban";

interface PendingPlayerAction {
  action: PlayerAction;
  player: ConnectedPlayer;
}

interface ServerPlayersProps {
  serverId: string;
}

export function ServerPlayers({ serverId }: ServerPlayersProps) {
  const [players, setPlayers] = useState<ConnectedPlayer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingPlayerAction | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadPlayers = useCallback(
    async (background = false) => {
      if (background) {
        setRefreshing(true);
      }

      setError(null);

      try {
        setPlayers(await getPlayers(serverId));
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
        <Group justify="space-between" align="flex-end">
          <div>
            <Title order={2}>Players</Title>
            <Text c="dimmed">View and manage connected players.</Text>
          </div>
          <Button
            variant="light"
            onClick={() => loadPlayers(true)}
            loading={refreshing}
            disabled={loading || submitting}
          >
            Refresh
          </Button>
        </Group>

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
          <Card withBorder radius="md" padding="xl">
            <Center mih={120}>
              <Stack align="center" gap="xs">
                <Title order={3}>No players online</Title>
                <Text c="dimmed">Connected players will appear here.</Text>
              </Stack>
            </Center>
          </Card>
        ) : filteredPlayers.length === 0 ? (
          <Alert color="gray">No players match your search.</Alert>
        ) : (
          <Card withBorder radius="md" padding={0}>
            <ScrollArea>
              <Table striped highlightOnHover miw={720}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Player Name</Table.Th>
                    <Table.Th>Player ID</Table.Th>
                    <Table.Th>IP Address</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredPlayers.map((player) => (
                    <Table.Tr key={player.userId}>
                      <Table.Td>{player.name}</Table.Td>
                      <Table.Td>
                        <Text ff="monospace" size="sm">
                          {player.playerId}
                        </Text>
                      </Table.Td>
                      <Table.Td>{player.ip ?? "Unavailable"}</Table.Td>
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
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Card>
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
