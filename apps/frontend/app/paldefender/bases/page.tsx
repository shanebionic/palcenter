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
import { getPalDefenderBases, type PalDefenderBase } from "../../../lib/api";

const coordinateFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
});

function position(value: { x: number; y: number; z: number }) {
  return [value.x, value.y, value.z]
    .map((part) => coordinateFormatter.format(part))
    .join(", ");
}

export default function PalDefenderBasesPage() {
  const [bases, setBases] = useState<PalDefenderBase[] | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const loadBases = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    setError("");
    try {
      setBases(await getPalDefenderBases());
    } catch (value) {
      setError(
        value instanceof Error ? value.message : "Unable to load bases.",
      );
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadBases();
  }, [loadBases]);

  const visibleBases = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return bases ?? [];
    return (bases ?? []).filter((base) =>
      [base.baseId, base.guildId, base.guildName, base.guildAdministrator.name]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase().includes(query)),
    );
  }, [bases, search]);

  return (
    <ApplicationShell>
      <Stack gap="xl">
        <PageHeader
          eyebrow="PalDefender"
          title="Bases"
          description="Base camp summaries reported within live PalDefender guild data."
          action={
            <Button
              variant="light"
              leftSection={<IconRefresh size={18} />}
              loading={refreshing}
              onClick={() => void loadBases(true)}
            >
              Refresh
            </Button>
          }
        />
        {error && <Alert color="red">{error}</Alert>}
        {!bases && !error && <BrandedLoader message="Loading bases" />}
        {bases && (
          <SectionCard p={0}>
            <Stack gap={0}>
              <Group p="lg">
                <TextInput
                  aria-label="Search bases"
                  placeholder="Search by base, guild, or administrator"
                  leftSection={<IconSearch size={16} />}
                  value={search}
                  onChange={(event) => setSearch(event.currentTarget.value)}
                  flex={1}
                />
              </Group>
              <ScrollArea>
                <Table verticalSpacing="md" horizontalSpacing="lg" miw={980}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Base ID</Table.Th>
                      <Table.Th>Guild</Table.Th>
                      <Table.Th>Guild ID</Table.Th>
                      <Table.Th>Administrator</Table.Th>
                      <Table.Th>Map Position</Table.Th>
                      <Table.Th>World Position</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {visibleBases.map((base) => (
                      <Table.Tr key={base.baseId}>
                        <Table.Td>
                          <Text ff="monospace" size="sm">
                            {base.baseId}
                          </Text>
                        </Table.Td>
                        <Table.Td fw={600}>{base.guildName ?? "—"}</Table.Td>
                        <Table.Td>
                          <Text ff="monospace" size="sm">
                            {base.guildId}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          {base.guildAdministrator.name ?? "—"}
                        </Table.Td>
                        <Table.Td>{position(base.mapPosition)}</Table.Td>
                        <Table.Td>{position(base.worldPosition)}</Table.Td>
                      </Table.Tr>
                    ))}
                    {visibleBases.length === 0 && (
                      <Table.Tr>
                        <Table.Td colSpan={6} ta="center" c="dimmed" py="xl">
                          {bases.length === 0
                            ? "PalDefender did not return any bases. Build a base in-game to populate this list."
                            : "No bases match your search."}
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
