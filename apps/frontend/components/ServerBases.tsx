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
import { getPalDefenderBases, type PalDefenderBase } from "../lib/api";
import { palDefenderBaseHref, palDefenderGuildHref } from "../lib/paldefender";
import { BrandedLoader } from "./BrandedLoader";
import { SectionCard } from "./ui/SectionCard";

const position = (value: { x: number; y: number; z: number }) =>
  `${value.x.toFixed(1)}, ${value.y.toFixed(1)}, ${value.z.toFixed(1)}`;
export function ServerBases({ serverId }: { serverId: string }) {
  const [bases, setBases] = useState<PalDefenderBase[] | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const load = useCallback(async () => {
    setError("");
    try {
      setBases(await getPalDefenderBases(serverId));
    } catch (value) {
      setError(
        value instanceof Error ? value.message : "Unable to load bases.",
      );
    }
  }, [serverId]);
  useEffect(() => {
    void load();
  }, [load]);
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (bases ?? []).filter(
      (base) =>
        !query ||
        [base.baseId, base.guildId, base.guildName].some((value) =>
          value?.toLowerCase().includes(query),
        ),
    );
  }, [bases, search]);
  return (
    <Stack mt="lg">
      <Group justify="space-between">
        <TextInput
          aria-label="Search bases"
          placeholder="Search bases"
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
        <Alert color="red" title="Bases unavailable">
          {error}
        </Alert>
      )}
      {!bases && !error && <BrandedLoader message="Loading bases" />}
      {bases && (
        <SectionCard p={0}>
          <Table verticalSpacing="md" horizontalSpacing="lg">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Base Camp ID</Table.Th>
                <Table.Th>Guild</Table.Th>
                <Table.Th>Map position</Table.Th>
                <Table.Th>World position</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {visible.map((base) => (
                <Table.Tr key={base.baseId}>
                  <Table.Td>
                    <Text
                      component={Link}
                      href={palDefenderBaseHref(serverId, base.baseId)}
                      c="cyan.4"
                      ff="monospace"
                    >
                      {base.baseId}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text
                      component={Link}
                      href={palDefenderGuildHref(serverId, base.guildId)}
                      c="cyan.4"
                    >
                      {base.guildName ?? base.guildId}
                    </Text>
                  </Table.Td>
                  <Table.Td>{position(base.mapPosition)}</Table.Td>
                  <Table.Td>{position(base.worldPosition)}</Table.Td>
                </Table.Tr>
              ))}
              {visible.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={4} ta="center" c="dimmed" py="xl">
                    {bases.length
                      ? "No bases match your search."
                      : "No bases were returned."}
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
