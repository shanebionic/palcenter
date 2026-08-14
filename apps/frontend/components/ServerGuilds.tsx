"use client";

import {
  Alert,
  Button,
  Group,
  Stack,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { IconRefresh, IconSearch } from "@tabler/icons-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getPalDefenderGuilds, type PalDefenderGuild } from "../lib/api";
import { palDefenderGuildHref } from "../lib/paldefender";
import { BrandedLoader } from "./BrandedLoader";
import { SectionCard } from "./ui/SectionCard";

export function ServerGuilds({ serverId }: { serverId: string }) {
  const [guilds, setGuilds] = useState<PalDefenderGuild[] | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const load = useCallback(async () => {
    setError("");
    try {
      setGuilds(await getPalDefenderGuilds(serverId));
    } catch (value) {
      setError(
        value instanceof Error ? value.message : "Unable to load guilds.",
      );
    }
  }, [serverId]);
  useEffect(() => {
    void load();
  }, [load]);
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (guilds ?? []).filter(
      (guild) =>
        !query ||
        [guild.name, guild.guildId, guild.administrator.name].some((value) =>
          value?.toLowerCase().includes(query),
        ),
    );
  }, [guilds, search]);
  return (
    <Stack mt="lg">
      <Group justify="space-between">
        <TextInput
          aria-label="Search guilds"
          placeholder="Search guilds"
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
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
        <Alert color="red" title="Guilds unavailable">
          {error}
        </Alert>
      )}
      {!guilds && !error && <BrandedLoader message="Loading guilds" />}
      {guilds && (
        <SectionCard p={0}>
          <Table verticalSpacing="md" horizontalSpacing="lg">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Guild</Table.Th>
                <Table.Th>Administrator</Table.Th>
                <Table.Th>Members</Table.Th>
                <Table.Th>Bases</Table.Th>
                <Table.Th>Level</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {visible.map((guild) => (
                <Table.Tr key={guild.guildId}>
                  <Table.Td>
                    <Text
                      component={Link}
                      href={palDefenderGuildHref(
                        serverId,
                        guild.guildId,
                        "guilds",
                      )}
                      c="cyan.4"
                      fw={600}
                    >
                      {guild.name ?? guild.guildId}
                    </Text>
                  </Table.Td>
                  <Table.Td>{guild.administrator.name ?? "—"}</Table.Td>
                  <Table.Td>{guild.memberCount}</Table.Td>
                  <Table.Td>{guild.baseCount}</Table.Td>
                  <Table.Td>{guild.level}</Table.Td>
                </Table.Tr>
              ))}
              {visible.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={5} ta="center" c="dimmed" py="xl">
                    {guilds.length
                      ? "No guilds match your search."
                      : "No guilds were returned."}
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
