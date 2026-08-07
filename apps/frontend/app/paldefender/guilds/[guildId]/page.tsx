"use client";

import {
  Alert,
  Badge,
  Button,
  Grid,
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
  getPalDefenderGuild,
  type PalDefenderGuildDetails,
} from "../../../../lib/api";
import { palDefenderPlayerHref } from "../../../../lib/paldefender";

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

export default function PalDefenderGuildDetailsPage() {
  const { guildId: encodedGuildId } = useParams<{ guildId: string }>();
  const guildId = decodeURIComponent(encodedGuildId);
  const [guild, setGuild] = useState<PalDefenderGuildDetails | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const loadGuild = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true);
      setError("");
      try {
        setGuild(await getPalDefenderGuild(guildId));
      } catch (value) {
        setError(
          value instanceof Error
            ? value.message
            : "Unable to load guild details.",
        );
      } finally {
        setRefreshing(false);
      }
    },
    [guildId],
  );

  useEffect(() => {
    void loadGuild();
  }, [loadGuild]);

  return (
    <ApplicationShell>
      <Stack gap="xl">
        <Button
          component={Link}
          href="/paldefender/guilds"
          variant="subtle"
          leftSection={<IconArrowLeft size={18} />}
          w="fit-content"
        >
          Back to Guilds
        </Button>
        <PageHeader
          eyebrow="PalDefender · Guild Details"
          title={guild?.name ?? "Guild Details"}
          description="Live guild membership, base, storage, expedition, and laboratory data."
          action={
            <Button
              variant="light"
              leftSection={<IconRefresh size={18} />}
              loading={refreshing}
              onClick={() => void loadGuild(true)}
            >
              Refresh
            </Button>
          }
        />
        {error && <Alert color="red">{error}</Alert>}
        {!guild && !error && <BrandedLoader message="Loading guild details" />}
        {guild && (
          <>
            <SectionCard>
              <Stack gap="lg">
                <Title order={2}>Overview</Title>
                <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
                  <Value label="Guild ID">
                    <Text ff="monospace" size="sm">
                      {guild.guildId}
                    </Text>
                  </Value>
                  <Value label="Level">{guild.level}</Value>
                  <Value label="Administrator">
                    {guild.administrator.name ?? "—"}
                  </Value>
                  <Value label="Administrator ID">
                    <Text ff="monospace" size="sm">
                      {guild.administrator.playerId}
                    </Text>
                  </Value>
                  <Value label="Members">{guild.memberCount}</Value>
                  <Value label="Bases">{guild.baseCount}</Value>
                  <Value label="Storage">
                    {guild.storage.occupiedSlots} / {guild.storage.maximumSlots}{" "}
                    slots
                  </Value>
                  <Value label="Finished Expeditions">
                    {guild.expeditions.finishedCount}
                  </Value>
                </SimpleGrid>
              </Stack>
            </SectionCard>

            <SectionCard p={0}>
              <Stack gap={0}>
                <Title order={2} p="lg">
                  Members
                </Title>
                <ScrollArea>
                  <Table verticalSpacing="md" horizontalSpacing="lg" miw={640}>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Name</Table.Th>
                        <Table.Th>Player ID</Table.Th>
                        <Table.Th>Status</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {guild.members.map((member) => (
                        <Table.Tr key={member.playerId}>
                          <Table.Td fw={600}>
                            <Text
                              component={Link}
                              href={palDefenderPlayerHref(member.playerId)}
                              c="cyan.4"
                            >
                              {member.name ?? "—"}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text ff="monospace" size="sm">
                              {member.playerId}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Badge
                              color={
                                member.status?.toLowerCase() === "online"
                                  ? "teal"
                                  : "gray"
                              }
                            >
                              {member.status ?? "—"}
                            </Badge>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                      {guild.members.length === 0 && (
                        <Table.Tr>
                          <Table.Td colSpan={3} ta="center" c="dimmed" py="xl">
                            PalDefender did not return any guild members.
                          </Table.Td>
                        </Table.Tr>
                      )}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
              </Stack>
            </SectionCard>

            <SectionCard>
              <Stack gap="lg">
                <Title order={2}>Bases</Title>
                {guild.camps.length === 0 && (
                  <Text c="dimmed">This guild does not have any bases.</Text>
                )}
                {guild.camps.map((camp) => (
                  <SectionCard key={camp.id}>
                    <Stack gap="md">
                      <Group justify="space-between">
                        <Text fw={700} ff="monospace">
                          {camp.id}
                        </Text>
                        <Badge>{camp.state ?? "Unknown"}</Badge>
                      </Group>
                      <SimpleGrid cols={{ base: 1, sm: 3 }}>
                        <Value label="Level">{camp.level}</Value>
                        <Value label="Workers">{camp.pals.length}</Value>
                        <Value label="Map Position">
                          {camp.mapPosition.x}, {camp.mapPosition.y},{" "}
                          {camp.mapPosition.z}
                        </Value>
                        <Value label="World Position">
                          {camp.worldPosition.x}, {camp.worldPosition.y},{" "}
                          {camp.worldPosition.z}
                        </Value>
                        <Value label="Buildings">{camp.buildings ?? "—"}</Value>
                      </SimpleGrid>
                      {camp.pals.length > 0 && (
                        <ScrollArea>
                          <Table miw={760}>
                            <Table.Thead>
                              <Table.Tr>
                                <Table.Th>Worker</Table.Th>
                                <Table.Th>Pal ID</Table.Th>
                                <Table.Th>Level</Table.Th>
                                <Table.Th>Gender</Table.Th>
                                <Table.Th>Sanity</Table.Th>
                                <Table.Th>Health</Table.Th>
                              </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                              {camp.pals.map((pal) => (
                                <Table.Tr key={pal.instanceId}>
                                  <Table.Td>{pal.nickname ?? "—"}</Table.Td>
                                  <Table.Td>{pal.palId}</Table.Td>
                                  <Table.Td>{pal.level}</Table.Td>
                                  <Table.Td>{pal.gender ?? "—"}</Table.Td>
                                  <Table.Td>{pal.sanity}</Table.Td>
                                  <Table.Td>
                                    {pal.physicalHealth ?? "—"}
                                  </Table.Td>
                                </Table.Tr>
                              ))}
                            </Table.Tbody>
                          </Table>
                        </ScrollArea>
                      )}
                    </Stack>
                  </SectionCard>
                ))}
              </Stack>
            </SectionCard>

            <Grid>
              <Grid.Col span={{ base: 12, lg: 4 }}>
                <SectionCard h="100%">
                  <Stack gap="md">
                    <Title order={2}>Storage</Title>
                    <Value label="Container ID">
                      {guild.storage.containerId ?? "—"}
                    </Value>
                    <Value label="Occupied Slots">
                      {guild.storage.occupiedSlots} /{" "}
                      {guild.storage.maximumSlots}
                    </Value>
                    <Text c="dimmed">
                      {guild.storage.items.length === 0
                        ? "No stored items were returned."
                        : `${guild.storage.items.length} item stacks returned.`}
                    </Text>
                    {guild.storage.items.length > 0 && (
                      <Table>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Slot</Table.Th>
                            <Table.Th>Item</Table.Th>
                            <Table.Th>Quantity</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {guild.storage.items.map((item) => (
                            <Table.Tr key={item.slot}>
                              <Table.Td>{item.slot}</Table.Td>
                              <Table.Td>{item.itemId}</Table.Td>
                              <Table.Td>{item.quantity}</Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    )}
                  </Stack>
                </SectionCard>
              </Grid.Col>
              <Grid.Col span={{ base: 12, lg: 4 }}>
                <SectionCard h="100%">
                  <Stack gap="md">
                    <Title order={2}>Expeditions</Title>
                    <Value label="Finished">
                      {guild.expeditions.finishedCount}
                    </Value>
                    <Value label="Released Missions">
                      {
                        Object.values(guild.expeditions.missions).filter(
                          Boolean,
                        ).length
                      }{" "}
                      / {Object.keys(guild.expeditions.missions).length}
                    </Value>
                    <Stack gap="xs">
                      {Object.entries(guild.expeditions.missions).map(
                        ([mission, released]) => (
                          <Group key={mission} justify="space-between">
                            <Text size="sm">{mission}</Text>
                            <Badge color={released ? "teal" : "gray"}>
                              {released ? "Released" : "Locked"}
                            </Badge>
                          </Group>
                        ),
                      )}
                    </Stack>
                  </Stack>
                </SectionCard>
              </Grid.Col>
              <Grid.Col span={{ base: 12, lg: 4 }}>
                <SectionCard h="100%">
                  <Stack gap="md">
                    <Title order={2}>Laboratory</Title>
                    <Value label="Current Research">
                      {guild.laboratory.currentResearch ?? "—"}
                    </Value>
                    <Value label="Active Research">
                      {guild.laboratory.researches.length}
                    </Value>
                    {guild.laboratory.researches.map((research) => (
                      <Stack key={research.researchId} gap={4}>
                        <Text fw={600}>{research.researchId}</Text>
                        <Text size="sm" c="dimmed">
                          {research.workAmount} / {research.requiredWorkAmount}{" "}
                          ({research.percentage}%)
                        </Text>
                      </Stack>
                    ))}
                  </Stack>
                </SectionCard>
              </Grid.Col>
            </Grid>
          </>
        )}
      </Stack>
    </ApplicationShell>
  );
}
