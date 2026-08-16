"use client";

import {
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  ScrollArea,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconArrowLeft,
  IconMap,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { PageHeader } from "./PageHeader";
import {
  deletePalDefenderBase,
  getPalDefenderBase,
  getPalDefenderBases,
  getSession,
  type PalDefenderBaseDetails,
} from "../lib/api";
import { catalogLabel, findPalEntry } from "../lib/game-catalogs";
import {
  canConfirmBaseDeletion,
  deleteBaseConfirmation,
  deleteBaseWarning,
} from "../lib/paldefender-bases";
import { baseMapDeepLinkHref, palDefenderGuildHref } from "../lib/paldefender";
import { detailBackTarget } from "../lib/navigation";
import { SectionCard } from "./ui/SectionCard";

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

export function ServerBaseWorkspace({
  serverId,
  baseId,
}: {
  serverId: string;
  baseId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const back = detailBackTarget(serverId, "base", searchParams.get("from"));
  const [base, setBase] = useState<PalDefenderBaseDetails | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [deleteOpened, setDeleteOpened] = useState(false);
  const [deleteConfirmationValue, setDeleteConfirmationValue] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [canOperate, setCanOperate] = useState(false);

  useEffect(() => {
    void getSession()
      .then((session) => {
        setCanOperate(session.user.role !== "visitor");
      })
      .catch(() => undefined);
  }, []);

  const loadBase = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true);
      setError("");
      try {
        setBase(await getPalDefenderBase(serverId, baseId));
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
    [serverId, baseId],
  );

  useEffect(() => {
    void loadBase();
  }, [loadBase]);

  const deleteBase = async () => {
    if (deleting || !base || !canConfirmBaseDeletion(deleteConfirmationValue)) {
      return;
    }
    setDeleting(true);
    let result: Awaited<ReturnType<typeof deletePalDefenderBase>>;
    try {
      result = await deletePalDefenderBase(serverId, base.baseId);
    } catch (value) {
      notifications.show({
        color: "red",
        title: "Unable to delete base",
        message:
          value instanceof Error
            ? value.message
            : "PalDefender could not delete this base.",
      });
      setDeleting(false);
      return;
    }

    let deletionIsAuthoritative = false;
    let refreshFailed = false;
    try {
      const bases = await getPalDefenderBases(serverId);
      deletionIsAuthoritative = !bases.some(
        (candidate) => candidate.baseId === base.baseId,
      );
    } catch {
      refreshFailed = true;
    }
    notifications.show({
      color: deletionIsAuthoritative ? "green" : "yellow",
      title: deletionIsAuthoritative ? "Base deleted" : "Deletion accepted",
      message: deletionIsAuthoritative
        ? `${result.base.summary || base.baseId} was permanently deleted.`
        : refreshFailed
          ? "PalDefender reported success, but PalCenter could not refresh guild data. Do not submit the deletion again; refresh the Bases page to verify."
          : "PalDefender reported success, but the base is still present in the latest guild data. Do not submit the deletion again; refresh before taking another action.",
    });
    setDeleteOpened(false);
    if (deletionIsAuthoritative || refreshFailed) {
      router.replace(`/servers/${encodeURIComponent(serverId)}?tab=bases`);
      router.refresh();
    }
    setDeleting(false);
  };

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
        eyebrow="Server · Base Details"
        title="Base Details"
        description="Live base camp ownership, position, state, and worker data."
        action={
          <Group gap="sm">
            {canOperate && (
              <Button
                variant="light"
                leftSection={<IconMap size={18} />}
                onClick={() =>
                  router.push(baseMapDeepLinkHref(serverId, baseId))
                }
              >
                View on map
              </Button>
            )}
            <Button
              variant="light"
              leftSection={<IconRefresh size={18} />}
              loading={refreshing}
              onClick={() => void loadBase(true)}
            >
              Refresh
            </Button>
          </Group>
        }
      />
      {error && <Alert color="red">{error}</Alert>}
      {!base && !error && (
        <Stack gap="md">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 animate-pulse" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 animate-pulse" />
        </Stack>
      )}
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
                    href={palDefenderGuildHref(
                      serverId,
                      base.guildId,
                      "guilds",
                    )}
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
                <Value label="Map Position">{position(base.mapPosition)}</Value>
                <Value label="World Position">
                  {position(base.worldPosition)}
                </Value>
                <Value label="Structures">{base.buildings ?? "—"}</Value>
              </SimpleGrid>
            </Stack>
          </SectionCard>

          <SectionCard>
            <Stack gap="md">
              <div>
                <Title order={2}>Danger zone</Title>
                <Text c="dimmed" size="sm">
                  Permanently delete this base and its associated camp data.
                </Text>
              </div>
              <Group justify="space-between" align="center">
                <div>
                  <Text fw={700}>Delete base</Text>
                  <Text c="dimmed" size="sm">
                    This operation cannot be undone and is never retried
                    automatically.
                  </Text>
                </div>
                <Button
                  color="red"
                  leftSection={<IconTrash size={18} />}
                  onClick={() => setDeleteOpened(true)}
                >
                  Delete Base
                </Button>
              </Group>
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
                  <Table verticalSpacing="md" horizontalSpacing="lg" miw={1100}>
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
                          <Table.Td fw={600}>
                            {(() => {
                              const entry = findPalEntry(pal.palId);
                              return entry ? catalogLabel(entry) : pal.palId;
                            })()}
                          </Table.Td>
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
      <Modal
        opened={deleteOpened}
        onClose={() => {
          if (!deleting) {
            setDeleteOpened(false);
            setDeleteConfirmationValue("");
          }
        }}
        title="Permanently Delete Base"
        centered
        closeOnClickOutside={!deleting}
        closeOnEscape={!deleting}
      >
        <Stack>
          <Alert color="red" title="This cannot be undone">
            {deleteBaseWarning}
          </Alert>
          {base && (
            <SimpleGrid cols={1} spacing="xs">
              <Value label="Guild">{base.guildName ?? "—"}</Value>
              <Value label="Base Camp ID">
                <Text ff="monospace" size="sm">
                  {base.baseId}
                </Text>
              </Value>
              <Value label="Map Position">{position(base.mapPosition)}</Value>
              <Value label="World Position">
                {position(base.worldPosition)}
              </Value>
            </SimpleGrid>
          )}
          <TextInput
            label={`Type ${deleteBaseConfirmation} to confirm`}
            value={deleteConfirmationValue}
            onChange={(event) =>
              setDeleteConfirmationValue(event.currentTarget.value)
            }
            disabled={deleting}
            autoComplete="off"
          />
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => setDeleteOpened(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              color="red"
              leftSection={<IconTrash size={18} />}
              loading={deleting}
              disabled={!canConfirmBaseDeletion(deleteConfirmationValue)}
              onClick={() => void deleteBase()}
            >
              Permanently Delete Base
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
