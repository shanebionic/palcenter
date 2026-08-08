"use client";

import {
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  banModerationIp,
  getModerationState,
  unbanModerationIp,
  unbanModerationUser,
  type ModerationState,
} from "../lib/api";
import { SectionCard } from "./ui/SectionCard";

type Pending =
  | { kind: "unban-user"; target: string }
  | { kind: "ban-ip"; target: string }
  | { kind: "unban-ip"; target: string };

function validIp(value: string) {
  const parts = value.split(".");
  if (parts.length === 4)
    return parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
  return (
    value.includes(":") &&
    /^[0-9a-f:]+$/i.test(value) &&
    (value.match(/::/g)?.length ?? 0) <= 1 &&
    value.split(":").length <= 8
  );
}

export function ServerModeration({ serverId }: { serverId: string }) {
  const [state, setState] = useState<ModerationState | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [ip, setIp] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setState(await getModerationState(serverId));
    } catch (cause) {
      setState(null);
      setError(
        cause instanceof Error ? cause.message : "Moderation is unavailable.",
      );
    } finally {
      setLoading(false);
    }
  }, [serverId]);
  useEffect(() => {
    setState(null);
    setSearch("");
    setPending(null);
    void load();
  }, [load]);
  const query = search.trim().toLowerCase();
  const users = useMemo(
    () =>
      (state?.userBans ?? []).filter(
        (entry) =>
          !query ||
          [entry.userId, entry.bannedBy.reason, entry.bannedBy.name].some(
            (value) => value.toLowerCase().includes(query),
          ),
      ),
    [state, query],
  );
  const ips = useMemo(
    () =>
      (state?.ipBans ?? []).filter(
        (entry) =>
          !query ||
          [entry.ip, entry.bannedBy.reason, entry.bannedBy.name].some((value) =>
            value.toLowerCase().includes(query),
          ),
      ),
    [state, query],
  );
  const execute = async () => {
    if (!pending || submitting) return;
    setSubmitting(true);
    try {
      if (pending.kind === "unban-user")
        await unbanModerationUser(serverId, pending.target, reason);
      else if (pending.kind === "ban-ip")
        await banModerationIp(serverId, pending.target, reason);
      else await unbanModerationIp(serverId, pending.target, reason);
      await load();
      notifications.show({
        color: "green",
        title: "Moderation updated",
        message:
          pending.kind === "ban-ip"
            ? "The IP address is now banned."
            : "The ban was removed.",
      });
      setPending(null);
      setReason("");
      if (pending.kind === "ban-ip") setIp("");
    } catch (cause) {
      notifications.show({
        color: "red",
        title: "Moderation action failed",
        message:
          cause instanceof Error
            ? cause.message
            : "The request failed. Refresh the banlist before retrying.",
      });
      await load();
    } finally {
      setSubmitting(false);
    }
  };
  if (loading && !state)
    return <Text c="dimmed">Loading moderation records…</Text>;
  if (error)
    return (
      <Alert color="orange" title="Moderation unavailable">
        {error}
        <Button mt="sm" variant="light" onClick={() => void load()}>
          Try again
        </Button>
      </Alert>
    );
  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <div>
          <Title order={3}>Moderation</Title>
          <Text c="dimmed" size="sm">
            Review and manage active user and IP bans.
          </Text>
        </div>
        <Button variant="light" loading={loading} onClick={() => void load()}>
          Refresh
        </Button>
      </Group>
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <SectionCard>
          <Text c="dimmed" size="sm">
            Banned players
          </Text>
          <Title order={2}>{state?.userBans.length ?? 0}</Title>
        </SectionCard>
        <SectionCard>
          <Text c="dimmed" size="sm">
            Banned IPs
          </Text>
          <Title order={2}>{state?.ipBans.length ?? 0}</Title>
        </SectionCard>
      </SimpleGrid>
      <TextInput
        label="Search moderation records"
        placeholder="User ID, IP address, reason, or issuer"
        value={search}
        onChange={(event) => setSearch(event.currentTarget.value)}
      />
      <SectionCard>
        <Stack>
          <Title order={4}>Banned players</Title>
          {!loading && users.length === 0 ? (
            <Text c="dimmed">No active user bans found.</Text>
          ) : (
            <Table.ScrollContainer minWidth={650}>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>User ID</Table.Th>
                    <Table.Th>Reason</Table.Th>
                    <Table.Th>Banned</Table.Th>
                    <Table.Th>Issuer</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {users.map((entry) => (
                    <Table.Tr key={entry.userId}>
                      <Table.Td>
                        <Text ff="monospace">{entry.userId}</Text>
                      </Table.Td>
                      <Table.Td>{entry.bannedBy.reason || "—"}</Table.Td>
                      <Table.Td>
                        {new Date(entry.bannedBy.timestamp).toLocaleString()}
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="light">{entry.bannedBy.type}</Badge>{" "}
                        {entry.bannedBy.name || "—"}
                      </Table.Td>
                      <Table.Td>
                        <Button
                          size="xs"
                          variant="light"
                          onClick={() =>
                            setPending({
                              kind: "unban-user",
                              target: entry.userId,
                            })
                          }
                        >
                          Unban
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
        </Stack>
      </SectionCard>
      <SectionCard>
        <Stack>
          <Title order={4}>Banned IP addresses</Title>
          {!loading && ips.length === 0 ? (
            <Text c="dimmed">No active IP bans found.</Text>
          ) : (
            <Table.ScrollContainer minWidth={650}>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>IP address</Table.Th>
                    <Table.Th>Reason</Table.Th>
                    <Table.Th>Banned</Table.Th>
                    <Table.Th>Issuer</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {ips.map((entry) => (
                    <Table.Tr key={entry.ip}>
                      <Table.Td>
                        <Text ff="monospace">{entry.ip}</Text>
                      </Table.Td>
                      <Table.Td>{entry.bannedBy.reason || "—"}</Table.Td>
                      <Table.Td>
                        {new Date(entry.bannedBy.timestamp).toLocaleString()}
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="light">{entry.bannedBy.type}</Badge>{" "}
                        {entry.bannedBy.name || "—"}
                      </Table.Td>
                      <Table.Td>
                        <Button
                          size="xs"
                          variant="light"
                          onClick={() =>
                            setPending({ kind: "unban-ip", target: entry.ip })
                          }
                        >
                          Unban IP
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
        </Stack>
      </SectionCard>
      <SectionCard>
        <Stack>
          <div>
            <Title order={4}>Ban IP address</Title>
            <Text c="dimmed" size="sm">
              Block connections from a specific IPv4 or IPv6 address.
            </Text>
          </div>
          <TextInput
            label="IP address"
            placeholder="192.0.2.10"
            value={ip}
            error={ip && !validIp(ip) ? "Enter a valid IP address." : undefined}
            onChange={(event) => setIp(event.currentTarget.value.trim())}
          />
          <Button
            w="fit-content"
            disabled={!validIp(ip)}
            onClick={() => setPending({ kind: "ban-ip", target: ip })}
          >
            Ban IP Address
          </Button>
        </Stack>
      </SectionCard>
      <Modal
        opened={pending !== null}
        onClose={() => !submitting && setPending(null)}
        title={
          pending?.kind === "ban-ip"
            ? "Ban IP Address"
            : pending?.kind === "unban-ip"
              ? "Unban IP"
              : "Unban Player"
        }
        centered
        closeOnClickOutside={!submitting}
        closeOnEscape={!submitting}
      >
        <Stack>
          <Text fw={700} ff="monospace">
            {pending?.target}
          </Text>
          <Text>
            {pending?.kind === "ban-ip"
              ? "Connections from this address will be blocked."
              : pending?.kind === "unban-ip"
                ? "Connections from this address will be allowed again."
                : "This will allow this user to reconnect to the server."}
          </Text>
          <Textarea
            label="Reason"
            description="Optional"
            value={reason}
            maxLength={2000}
            onChange={(event) => setReason(event.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button
              variant="default"
              disabled={submitting}
              onClick={() => setPending(null)}
            >
              Cancel
            </Button>
            <Button
              color={pending?.kind === "ban-ip" ? "red" : "blue"}
              loading={submitting}
              onClick={() => void execute()}
            >
              {pending?.kind === "ban-ip"
                ? "Ban IP"
                : pending?.kind === "unban-ip"
                  ? "Unban IP"
                  : "Unban"}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
