"use client";

import {
  Alert,
  Badge,
  Button,
  Group,
  ScrollArea,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { IconArrowLeft, IconRefresh } from "@tabler/icons-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ApplicationShell } from "../../../../components/ApplicationShell";
import { BrandedLoader } from "../../../../components/BrandedLoader";
import { PageHeader } from "../../../../components/PageHeader";
import { SectionCard } from "../../../../components/ui/SectionCard";
import {
  getPalDefenderBase,
  type PalDefenderBaseDetails,
} from "../../../../lib/api";
import { palDefenderGuildHref } from "../../../../lib/paldefender";

const coordinateFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
});

function position(value: { x: number; y: number; z: number }) {
  return [value.x, value.y, value.z]
    .map((part) => coordinateFormatter.format(part))
    .join(", ");
}

function Value({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack gap={2}>
      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
        {label}
      </Text>
      <Text>{children}</Text>
    </Stack>
  );
}

export default function PalDefenderBaseDetailsPage() {
  const { baseId: encodedBaseId } = useParams<{ baseId: string }>();
  const baseId = decodeURIComponent(encodedBaseId);
  const [base, setBase] = useState<PalDefenderBaseDetails | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const loadBase = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true);
      setError("");
      try {
        setBase(await getPalDefenderBase(baseId));
      } catch (value) {
        setError(
          value instanceof Error
            ? value.message
            : "Unable to load base details.",
        );
      } finally {
        setRefreshing(false);
      }
    },
    [baseId],
  );

  useEffect(() => {
    void loadBase();
  }, [loadBase]);

  return (
    <ApplicationShell>
      <Stack gap="xl">
        <Button
          component={Link}
          href="/paldefender/bases"
          variant="subtle"
          leftSection={<IconArrowLeft size={18} />}
          w="fit-content"
        >
          Back to Bases
        </Button>
        <PageHeader
          eyebrow="PalDefender · Base Details"
          title="Base Details"
          description="Live base camp ownership, position, state, and worker data."
          action={
            <Button
              variant="light"
              leftSection={<IconRefresh size={18} />}
              loading={refreshing}
              onClick={() => void loadBase(true)}
            >
              Refresh
            </Button>
          }
        />
        {error && <Alert color="red">{error}</Alert>}
        {!base && !error && <BrandedLoader message="Loading base details" />}
        {base && (
          <>
            <SectionCard>
              <Stack gap="lg">
                <Group justify="space-between" align="flex-start">
                  <Title order={2}>Overview</Title>
                  <Badge color={base.state === "Normal" ? "teal" : "gray"}>
                    {base.state ?? "—"}
                  </Badge>
                </Group>
                <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
                  <Value label="Base ID">
                    <Text ff="monospace" size="sm">
                      {base.baseId}
                    </Text>
                  </Value>
                  <Value label="Level">{base.level}</Value>
                  <Value label="Workers">{base.pals.length}</Value>
                  <Value label="Guild">
                    <Text
                      component={Link}
                      href={palDefenderGuildHref(base.guildId)}
                      c="cyan.4"
                    >
                      {base.guildName ?? "—"}
                    </Text>
                  </Value>
                  <Value label="Guild ID">
                    <Text ff="monospace" size="sm">
                      {base.guildId}
                    </Text>
                  </Value>
                  <Value label="Guild Administrator">
                    {base.guildAdministrator.name ?? "—"}
                  </Value>
                  <Value label="Map Position">
                    {position(base.mapPosition)}
                  </Value>
                  <Value label="World Position">
                    {position(base.worldPosition)}
                  </Value>
                  <Value label="Structures">{base.buildings ?? "—"}</Value>
                </SimpleGrid>
              </Stack>
            </SectionCard>

            <SectionCard p={0}>
              <Stack gap={0}>
                <Title order={2} p="lg">
                  Workers
                </Title>
                {base.pals.length === 0 ? (
                  <Text c="dimmed" px="lg" pb="lg">
                    PalDefender did not return any workers for this base.
                  </Text>
                ) : (
                  <ScrollArea>
                    <Table
                      verticalSpacing="md"
                      horizontalSpacing="lg"
                      miw={1100}
                    >
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Name</Table.Th>
                          <Table.Th>Pal ID</Table.Th>
                          <Table.Th>Level</Table.Th>
                          <Table.Th>Gender</Table.Th>
                          <Table.Th>Sanity</Table.Th>
                          <Table.Th>Health</Table.Th>
                          <Table.Th>Sickness</Table.Th>
                          <Table.Th>Passive Skills</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {base.pals.map((pal) => (
                          <Table.Tr key={pal.instanceId}>
                            <Table.Td fw={600}>{pal.nickname ?? "—"}</Table.Td>
                            <Table.Td>{pal.palId}</Table.Td>
                            <Table.Td>{pal.level}</Table.Td>
                            <Table.Td>{pal.gender ?? "—"}</Table.Td>
                            <Table.Td>{pal.sanity}</Table.Td>
                            <Table.Td>{pal.physicalHealth ?? "—"}</Table.Td>
                            <Table.Td>{pal.workerSick ?? "—"}</Table.Td>
                            <Table.Td>
                              {pal.passiveSkills.length > 0
                                ? pal.passiveSkills.join(", ")
                                : "—"}
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </ScrollArea>
                )}
              </Stack>
            </SectionCard>
          </>
        )}
      </Stack>
    </ApplicationShell>
  );
}
