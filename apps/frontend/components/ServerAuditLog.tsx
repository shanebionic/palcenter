"use client";

import {
  Alert,
  Badge,
  Button,
  Group,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { IconRefresh, IconSearch } from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getAdministrativeAuditLog,
  type AdministrativeAuditEntry,
} from "../lib/api";
import { BrandedLoader } from "./BrandedLoader";
import { SectionCard } from "./ui/SectionCard";

const labels: Record<string, string> = {
  delete_base: "Deleted base",
  learn_technology: "Learned technology",
  forget_technology: "Forgot technology",
  give_progression: "Granted progression",
  give_items: "Gave items",
  give_pal: "Gave Pal",
  give_pal_template: "Gave Pal from template",
  give_pal_egg: "Gave Pal egg",
  kick_player: "Kicked player",
  ban_player: "Banned player",
  unban_player: "Unbanned player",
  ban_ip: "Banned IP address",
  unban_ip: "Unbanned IP address",
  broadcast: "Sent broadcast",
  alert: "Sent alert",
  send_player_message: "Sent player message",
  reload_paldefender: "Reloaded PalDefender configuration",
  native_broadcast: "Sent broadcast",
  save_world: "Saved world",
  shutdown_server: "Shut down server",
  force_stop_server: "Force stopped server",
  native_kick_player: "Kicked player",
  native_ban_player: "Banned player",
  native_unban_player: "Unbanned player",
};
const actionLabel = (action: string) =>
  labels[action] ?? action.replaceAll("_", " ");

export function ServerAuditLog({ serverId }: { serverId: string }) {
  const [entries, setEntries] = useState<AdministrativeAuditEntry[] | null>(
    null,
  );
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [actor, setActor] = useState<string | null>(null);
  const [range, setRange] = useState("7");
  const load = useCallback(async () => {
    setError("");
    try {
      setEntries(await getAdministrativeAuditLog(serverId));
    } catch (value) {
      setError(
        value instanceof Error ? value.message : "Unable to load audit log.",
      );
    }
  }, [serverId]);
  useEffect(() => {
    void load();
  }, [load]);
  const actors = useMemo(
    () => [
      ...new Map(
        (entries ?? []).map((entry) => [
          entry.actorUserId,
          { value: entry.actorUserId, label: entry.actorUsername },
        ]),
      ).values(),
    ],
    [entries],
  );
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    const cutoff = range === "all" ? 0 : Date.now() - Number(range) * 86400000;
    return (entries ?? []).filter(
      (entry) =>
        (!actor || entry.actorUserId === actor) &&
        (!category || entry.category === category) &&
        (!result || entry.result === result) &&
        (!cutoff || Date.parse(entry.occurredAt) >= cutoff) &&
        (!query ||
          [entry.actorUsername, actionLabel(entry.action), entry.targetId].some(
            (value) => value?.toLowerCase().includes(query),
          )),
    );
  }, [entries, actor, category, result, range, search]);
  return (
    <Stack mt="lg">
      <Group align="end">
        <TextInput
          label="Search"
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
        />
        <Select
          label="Actor"
          placeholder="All"
          clearable
          data={actors}
          value={actor}
          onChange={setActor}
        />
        <Select
          label="Category"
          placeholder="All"
          clearable
          data={["players", "moderation", "messaging", "server", "bases"]}
          value={category}
          onChange={setCategory}
        />
        <Select
          label="Result"
          placeholder="All"
          clearable
          data={["success", "failed"]}
          value={result}
          onChange={setResult}
        />
        <Select
          label="Time"
          data={[
            { value: "1", label: "24 hours" },
            { value: "7", label: "7 days" },
            { value: "30", label: "30 days" },
            { value: "all", label: "All time" },
          ]}
          value={range}
          onChange={(value) => setRange(value ?? "7")}
        />
        <Button
          variant="light"
          leftSection={<IconRefresh size={16} />}
          onClick={() => void load()}
        >
          Refresh
        </Button>
      </Group>
      {error && (
        <Alert color="red" title="Audit log unavailable">
          {error}
        </Alert>
      )}
      {!entries && !error && <BrandedLoader message="Loading audit log" />}
      {entries && (
        <SectionCard p={0}>
          <Table verticalSpacing="md" horizontalSpacing="lg">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Time</Table.Th>
                <Table.Th>Actor</Table.Th>
                <Table.Th>Action</Table.Th>
                <Table.Th>Target</Table.Th>
                <Table.Th>Result</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {visible.map((entry) => (
                <Table.Tr key={entry.id}>
                  <Table.Td>
                    <Text size="sm">
                      {new Date(entry.occurredAt).toLocaleString()}
                    </Text>
                  </Table.Td>
                  <Table.Td>{entry.actorUsername}</Table.Td>
                  <Table.Td>{actionLabel(entry.action)}</Table.Td>
                  <Table.Td ff="monospace">{entry.targetId ?? "—"}</Table.Td>
                  <Table.Td>
                    <Badge color={entry.result === "success" ? "teal" : "red"}>
                      {entry.result}
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
              {visible.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={5} ta="center" c="dimmed" py="xl">
                    No administrative actions match these filters.
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </SectionCard>
      )}
    </Stack>
  );
}
