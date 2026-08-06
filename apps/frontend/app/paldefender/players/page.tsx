"use client";

import { Alert, Badge, ScrollArea, Stack, Table, Text } from "@mantine/core";
import { useEffect, useState } from "react";
import { ApplicationShell } from "../../../components/ApplicationShell";
import { BrandedLoader } from "../../../components/BrandedLoader";
import { PageHeader } from "../../../components/PageHeader";
import { SectionCard } from "../../../components/ui/SectionCard";
import {
  getPalDefenderPlayers,
  type PalDefenderPlayer,
} from "../../../lib/api";

export default function PalDefenderPlayersPage() {
  const [players, setPlayers] = useState<PalDefenderPlayer[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void getPalDefenderPlayers()
      .then(setPlayers)
      .catch((value: unknown) => {
        setError(
          value instanceof Error ? value.message : "Unable to load players.",
        );
      });
  }, []);

  return (
    <ApplicationShell>
      <Stack gap="xl">
        <PageHeader
          eyebrow="PalDefender"
          title="Players"
          description="Known players reported live by the configured PalDefender server."
        />
        {error && <Alert color="red">{error}</Alert>}
        {!players && !error && <BrandedLoader message="Loading players" />}
        {players && (
          <SectionCard p={0}>
            <ScrollArea>
              <Table verticalSpacing="md" horizontalSpacing="lg" miw={720}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Name</Table.Th>
                    <Table.Th>Player ID</Table.Th>
                    <Table.Th>Online</Table.Th>
                    <Table.Th>Guild</Table.Th>
                    <Table.Th>Level</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {players.map((player) => (
                    <Table.Tr key={player.playerId}>
                      <Table.Td fw={600}>{player.name}</Table.Td>
                      <Table.Td>
                        <Text ff="monospace" size="sm">
                          {player.playerId}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={player.online ? "teal" : "gray"}>
                          {player.online ? "Online" : "Offline"}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{player.guild ?? "—"}</Table.Td>
                      <Table.Td>{player.level ?? "—"}</Table.Td>
                    </Table.Tr>
                  ))}
                  {players.length === 0 && (
                    <Table.Tr>
                      <Table.Td colSpan={5} ta="center" c="dimmed" py="xl">
                        PalDefender did not return any players.
                      </Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </SectionCard>
        )}
      </Stack>
    </ApplicationShell>
  );
}
