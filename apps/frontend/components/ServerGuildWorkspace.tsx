"use client";

import {
  Alert,
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
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { PageHeader } from "./PageHeader";
import { detailBackTarget } from "../lib/navigation";
import { getPalDefenderGuild, type PalDefenderGuildDetails } from "../lib/api";
import { palDefenderBaseHref } from "../lib/paldefender";
import { SectionCard } from "./ui/SectionCard";

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

export function ServerGuildWorkspace({
  serverId,
  guildId,
}: {
  serverId: string;
  guildId: string;
}) {
  const searchParams = useSearchParams();
  const back = detailBackTarget(serverId, "guild", searchParams.get("from"));
  const [guild, setGuild] = useState<PalDefenderGuildDetails | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const loadGuild = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true);
      setError("");
      try {
        setGuild(await getPalDefenderGuild(serverId, guildId));
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
    [serverId, guildId],
  );

  useEffect(() => {
    void loadGuild();
  }, [loadGuild]);

  return (
    <Stack gap="xl">
      <Button
        component={Link}
        href={back.href}
        variant="subtle"
        leftSection={<IconArrowLeft size={18} />}
        w="fit-content"
      >
        {back.label}
      </Button>
      <PageHeader
        eyebrow="Server · Guild Details"
        title="Guild Details"
        description="Live guild membership and base-camp state from PalDefender."
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
      {!guild && !error && (
        <Stack gap="md">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 animate-pulse" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 animate-pulse" />
        </Stack>
      )}
      {guild && (
        <>
          <SectionCard>
            <Stack gap="lg">
              <Group justify="space-between" align="flex-start">
                <Title order={2}>Overview</Title>
              </Group>
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
                <Value label="Guild ID">
                  <Text ff="monospace" size="sm">
                    {guild.guildId}
                  </Text>
                </Value>
                <Value label="Name">{guild.name ?? "—"}</Value>
                <Value label="Level">{guild.level}</Value>
                <Value label="Members">{guild.memberCount}</Value>
                <Value label="Bases">{guild.baseCount}</Value>
                <Value label="Administrator">
                  {guild.administrator.name ?? "—"}
                </Value>
              </SimpleGrid>
            </Stack>
          </SectionCard>

          <SectionCard p={0}>
            <Stack gap={0}>
              <Title order={2} p="lg">
                Members
              </Title>
              {guild.members.length === 0 ? (
                <Text c="dimmed" px="lg" pb="lg">
                  PalDefender did not return any members for this guild.
                </Text>
              ) : (
                <ScrollArea>
                  <Table verticalSpacing="md" horizontalSpacing="lg" miw={1100}>
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
                          <Table.Td fw={600}>{member.name ?? "—"}</Table.Td>
                          <Table.Td>{member.playerId}</Table.Td>
                          <Table.Td>{member.status ?? "—"}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
              )}
            </Stack>
          </SectionCard>

          <SectionCard p={0}>
            <Stack gap={0}>
              <Title order={2} p="lg">
                Base Camps
              </Title>
              {guild.camps.length === 0 ? (
                <Text c="dimmed" px="lg" pb="lg">
                  PalDefender did not return any base camps for this guild.
                </Text>
              ) : (
                <ScrollArea>
                  <Table verticalSpacing="md" horizontalSpacing="lg" miw={1100}>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Base ID</Table.Th>
                        <Table.Th>State</Table.Th>
                        <Table.Th>Level</Table.Th>
                        <Table.Th>Workers</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {guild.camps.map((camp) => (
                        <Table.Tr key={camp.id}>
                          <Table.Td>
                            <Text
                              component={Link}
                              href={palDefenderBaseHref(
                                serverId,
                                camp.id,
                                "guilds",
                              )}
                              c="cyan.4"
                              ff="monospace"
                            >
                              {camp.id}
                            </Text>
                          </Table.Td>
                          <Table.Td>{camp.state ?? "—"}</Table.Td>
                          <Table.Td>{camp.level ?? "—"}</Table.Td>
                          <Table.Td>{camp.pals?.length ?? 0}</Table.Td>
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
  );
}
