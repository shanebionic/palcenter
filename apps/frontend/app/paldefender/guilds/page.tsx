"use client";

import {
  Alert,
  Button,
  Group,
  ScrollArea,
  Stack,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { IconRefresh, IconSearch } from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ApplicationShell } from "../../../components/ApplicationShell";
import { BrandedLoader } from "../../../components/BrandedLoader";
import { PageHeader } from "../../../components/PageHeader";
import { SectionCard } from "../../../components/ui/SectionCard";
import { getPalDefenderGuilds, type PalDefenderGuild } from "../../../lib/api";

export default function PalDefenderGuildsPage() {
  const [guilds, setGuilds] = useState<PalDefenderGuild[] | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const loadGuilds = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    setError("");
    try {
      setGuilds(await getPalDefenderGuilds());
    } catch (value) {
      setError(
        value instanceof Error ? value.message : "Unable to load guilds.",
      );
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadGuilds();
  }, [loadGuilds]);

  const visibleGuilds = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return guilds ?? [];
    return (guilds ?? []).filter((guild) =>
      [
        guild.name,
        guild.guildId,
        guild.administrator.name,
        guild.administrator.playerId,
      ]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase().includes(query)),
    );
  }, [guilds, search]);

  return (
    <ApplicationShell>
      <Stack gap="xl">
        <PageHeader
          eyebrow="PalDefender"
          title="Guilds"
          description="Guild summaries reported live by the configured PalDefender server."
          action={
            <Button
              variant="light"
              leftSection={<IconRefresh size={18} />}
              loading={refreshing}
              onClick={() => void loadGuilds(true)}
            >
              Refresh
            </Button>
          }
        />
        {error && <Alert color="red">{error}</Alert>}
        {!guilds && !error && <BrandedLoader message="Loading guilds" />}
        {guilds && (
          <SectionCard p={0}>
            <Stack gap={0}>
              <Group p="lg">
                <TextInput
                  aria-label="Search guilds"
                  placeholder="Search by guild or administrator"
                  leftSection={<IconSearch size={16} />}
                  value={search}
                  onChange={(event) => setSearch(event.currentTarget.value)}
                  flex={1}
                />
              </Group>
              <ScrollArea>
                <Table verticalSpacing="md" horizontalSpacing="lg" miw={820}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Guild</Table.Th>
                      <Table.Th>Guild ID</Table.Th>
                      <Table.Th>Administrator</Table.Th>
                      <Table.Th>Members</Table.Th>
                      <Table.Th>Bases</Table.Th>
                      <Table.Th>Level</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {visibleGuilds.map((guild) => (
                      <Table.Tr key={guild.guildId}>
                        <Table.Td fw={600}>{guild.name ?? "—"}</Table.Td>
                        <Table.Td>
                          <Text ff="monospace" size="sm">
                            {guild.guildId}
                          </Text>
                        </Table.Td>
                        <Table.Td>{guild.administrator.name ?? "—"}</Table.Td>
                        <Table.Td>{guild.memberCount}</Table.Td>
                        <Table.Td>{guild.baseCount}</Table.Td>
                        <Table.Td>{guild.level}</Table.Td>
                      </Table.Tr>
                    ))}
                    {visibleGuilds.length === 0 && (
                      <Table.Tr>
                        <Table.Td colSpan={6} ta="center" c="dimmed" py="xl">
                          {guilds.length === 0
                            ? "PalDefender did not return any guilds."
                            : "No guilds match your search."}
                        </Table.Td>
                      </Table.Tr>
                    )}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </Stack>
          </SectionCard>
        )}
      </Stack>
    </ApplicationShell>
  );
}
