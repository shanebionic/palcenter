"use client";

import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconArrowLeft,
  IconBackpack,
  IconRefresh,
  IconSearch,
  IconShieldCheck,
  IconSparkles,
  IconUserMinus,
  IconUser,
} from "@tabler/icons-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ApplicationShell } from "./ApplicationShell";
import { BrandedLoader } from "./BrandedLoader";
import { SectionCard } from "./ui/SectionCard";
import {
  getPalDefenderInventory,
  getPalDefenderPals,
  getPalDefenderPlayer,
  getPalDefenderPlayers,
  getPalDefenderTechnology,
  kickPalDefenderPlayer,
  type PalDefenderInventoryItem,
  type PalDefenderPal,
  type PalDefenderPlayerDetails,
} from "../lib/api";

type TabName = "overview" | "inventory" | "pals" | "technology" | "actions";
type Loadable<T> = { data: T | null; loading: boolean; error: string };
const initial = <T,>(): Loadable<T> => ({
  data: null,
  loading: false,
  error: "",
});
const message = (error: unknown) =>
  error instanceof Error ? error.message : "Unable to load PalDefender data.";

export function PalDefenderPlayerWorkspace({ playerId }: { playerId: string }) {
  const [activeTab, setActiveTab] = useState<TabName>("overview");
  const [player, setPlayer] =
    useState<Loadable<PalDefenderPlayerDetails>>(initial);
  const [inventory, setInventory] =
    useState<Loadable<PalDefenderInventoryItem[]>>(initial);
  const [pals, setPals] = useState<Loadable<PalDefenderPal[]>>(initial);
  const [technology, setTechnology] = useState<Loadable<string[]>>(initial);
  const [kickOpened, setKickOpened] = useState(false);
  const [kickMessage, setKickMessage] = useState("");
  const [kicking, setKicking] = useState(false);

  const loadPlayer = useCallback(async () => {
    setPlayer((value) => ({ ...value, loading: true, error: "" }));
    try {
      setPlayer({
        data: await getPalDefenderPlayer(playerId),
        loading: false,
        error: "",
      });
    } catch (error) {
      const listedPlayer = await getPalDefenderPlayers()
        .then((players) =>
          players.find((candidate) => candidate.playerId === playerId),
        )
        .catch(() => undefined);
      if (listedPlayer) {
        setPlayer({
          data: {
            ...listedPlayer,
            worldLocation: null,
            mapLocation: null,
          },
          loading: false,
          error: "",
        });
        return;
      }
      setPlayer((value) => ({
        ...value,
        loading: false,
        error: message(error),
      }));
    }
  }, [playerId]);
  const loadInventory = useCallback(
    async () =>
      loadCollection(setInventory, () => getPalDefenderInventory(playerId)),
    [playerId],
  );
  const loadPals = useCallback(
    async () => loadCollection(setPals, () => getPalDefenderPals(playerId)),
    [playerId],
  );
  const loadTechnology = useCallback(
    async () =>
      loadCollection(setTechnology, () => getPalDefenderTechnology(playerId)),
    [playerId],
  );

  useEffect(() => {
    void loadPlayer();
  }, [loadPlayer]);
  useEffect(() => {
    if (
      activeTab === "inventory" &&
      inventory.data === null &&
      !inventory.loading
    )
      void loadInventory();
    if (activeTab === "pals" && pals.data === null && !pals.loading)
      void loadPals();
    if (
      activeTab === "technology" &&
      technology.data === null &&
      !technology.loading
    )
      void loadTechnology();
  }, [
    activeTab,
    inventory,
    pals,
    technology,
    loadInventory,
    loadPals,
    loadTechnology,
  ]);

  const refresh = () => {
    void loadPlayer();
    if (activeTab === "inventory") void loadInventory();
    if (activeTab === "pals") void loadPals();
    if (activeTab === "technology") void loadTechnology();
  };

  const kickPlayer = async () => {
    if (kicking) return;
    setKicking(true);
    try {
      const result = await kickPalDefenderPlayer(playerId, kickMessage);
      setKickOpened(false);
      setKickMessage("");
      notifications.show({
        color: "green",
        title: "Player kicked",
        message: `${player.data?.name ?? "The player"} was disconnected from the server.`,
      });
      await Promise.all([loadPlayer(), getPalDefenderPlayers()]);
      return result;
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Unable to kick player",
        message:
          error instanceof Error
            ? error.message
            : "PalDefender could not kick this player.",
      });
    } finally {
      setKicking(false);
    }
  };

  return (
    <ApplicationShell>
      <Stack gap="xl">
        <Group justify="space-between" align="flex-start">
          <Stack gap="sm">
            <Button
              component={Link}
              href="/paldefender/players"
              variant="subtle"
              leftSection={<IconArrowLeft size={17} />}
              w="fit-content"
              px={0}
            >
              Back to Players
            </Button>
            <Text size="xs" tt="uppercase" fw={700} c="cyan.4" lts={1.4}>
              PalDefender · Player Details
            </Text>
            <Title order={1}>{player.data?.name ?? "Player"}</Title>
            <Group gap="sm">
              <Text ff="monospace" c="dimmed">
                {playerId}
              </Text>
              {player.data && (
                <Badge color={player.data.online ? "teal" : "gray"}>
                  {player.data.online ? "Online" : "Offline"}
                </Badge>
              )}
            </Group>
            <Text c="dimmed">Guild: {player.data?.guild ?? "—"}</Text>
          </Stack>
          <Button
            leftSection={<IconRefresh size={17} />}
            onClick={refresh}
            loading={player.loading}
          >
            Refresh
          </Button>
        </Group>
        {player.error && (
          <Alert color="red" title="Player details unavailable">
            {player.error}
          </Alert>
        )}
        <SectionCard>
          <Tabs
            value={activeTab}
            onChange={(value) => setActiveTab((value ?? "overview") as TabName)}
          >
            <Tabs.List>
              <Tabs.Tab value="overview" leftSection={<IconUser size={16} />}>
                Overview
              </Tabs.Tab>
              <Tabs.Tab
                value="inventory"
                leftSection={<IconBackpack size={16} />}
              >
                Inventory
              </Tabs.Tab>
              <Tabs.Tab value="pals" leftSection={<IconSparkles size={16} />}>
                Pals
              </Tabs.Tab>
              <Tabs.Tab
                value="technology"
                leftSection={<IconShieldCheck size={16} />}
              >
                Technology
              </Tabs.Tab>
              <Tabs.Tab
                value="actions"
                leftSection={<IconUserMinus size={16} />}
              >
                Actions
              </Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="overview" pt="xl">
              <Overview state={player} />
            </Tabs.Panel>
            <Tabs.Panel value="inventory" pt="xl">
              <Inventory state={inventory} refresh={loadInventory} />
            </Tabs.Panel>
            <Tabs.Panel value="pals" pt="xl">
              <Pals state={pals} refresh={loadPals} />
            </Tabs.Panel>
            <Tabs.Panel value="technology" pt="xl">
              <Technology state={technology} refresh={loadTechnology} />
            </Tabs.Panel>
            <Tabs.Panel value="actions" pt="xl">
              <Stack gap="md">
                <div>
                  <Title order={3}>Kick Player</Title>
                  <Text c="dimmed" size="sm">
                    Immediately disconnect this player without banning them.
                  </Text>
                </div>
                <Button
                  color="red"
                  leftSection={<IconUserMinus size={18} />}
                  onClick={() => setKickOpened(true)}
                  w="fit-content"
                >
                  Kick Player
                </Button>
              </Stack>
            </Tabs.Panel>
          </Tabs>
        </SectionCard>
      </Stack>
      <Modal
        opened={kickOpened}
        onClose={() => {
          if (!kicking) setKickOpened(false);
        }}
        title="Kick Player"
        centered
        closeOnClickOutside={!kicking}
        closeOnEscape={!kicking}
      >
        <Stack>
          <Text>
            <Text span fw={700}>
              {player.data?.name ?? "This player"}
            </Text>{" "}
            will be immediately disconnected from the server.
          </Text>
          <Textarea
            label="Optional message"
            description="PalDefender will use this as the kick reason."
            placeholder="Explain why the player is being disconnected"
            minRows={4}
            maxLength={2_000}
            value={kickMessage}
            onChange={(event) => setKickMessage(event.currentTarget.value)}
            disabled={kicking}
          />
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => setKickOpened(false)}
              disabled={kicking}
            >
              Cancel
            </Button>
            <Button
              color="red"
              leftSection={<IconUserMinus size={18} />}
              loading={kicking}
              disabled={kicking}
              onClick={() => void kickPlayer()}
            >
              Kick Player
            </Button>
          </Group>
        </Stack>
      </Modal>
    </ApplicationShell>
  );
}

async function loadCollection<T>(
  setter: React.Dispatch<React.SetStateAction<Loadable<T>>>,
  loader: () => Promise<T>,
) {
  setter((value) => ({ ...value, loading: true, error: "" }));
  try {
    setter({ data: await loader(), loading: false, error: "" });
  } catch (error) {
    setter((value) => ({ ...value, loading: false, error: message(error) }));
  }
}

function State<T>({
  state,
  empty,
  children,
}: {
  state: Loadable<T[]>;
  empty: string;
  children: (data: T[]) => React.ReactNode;
}) {
  if (state.loading && state.data === null)
    return <BrandedLoader message="Loading live PalDefender data" />;
  if (state.error) return <Alert color="red">{state.error}</Alert>;
  if (!state.data?.length)
    return (
      <Text ta="center" c="dimmed" py="xl">
        {empty}
      </Text>
    );
  return children(state.data);
}

function Overview({ state }: { state: Loadable<PalDefenderPlayerDetails> }) {
  if (state.loading && !state.data)
    return <BrandedLoader message="Loading player details" />;
  if (!state.data)
    return (
      <Text ta="center" c="dimmed" py="xl">
        Player details are unavailable.
      </Text>
    );
  const p = state.data;
  const rows = [
    ["Name", p.name],
    ["Player ID", p.playerId],
    ["Guild", p.guild],
    ["Online status", p.online ? "Online" : "Offline"],
    ["Level", p.level],
    ["World X", p.worldLocation?.x],
    ["World Y", p.worldLocation?.y],
    ["World Z", p.worldLocation?.z],
    ["Map X", p.mapLocation?.x],
    ["Map Y", p.mapLocation?.y],
    ["Map Z", p.mapLocation?.z],
  ];
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
      {rows.map(([label, value]) => (
        <Card key={String(label)} withBorder>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            {label}
          </Text>
          <Text mt={4} fw={600}>
            {value ?? "—"}
          </Text>
        </Card>
      ))}
    </SimpleGrid>
  );
}

function Inventory({
  state,
  refresh,
}: {
  state: Loadable<PalDefenderInventoryItem[]>;
  refresh: () => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("item");
  const items = useMemo(
    () =>
      [...(state.data ?? [])]
        .filter((item) =>
          item.itemId.toLowerCase().includes(search.toLowerCase()),
        )
        .sort((a, b) =>
          sort === "quantity"
            ? b.quantity - a.quantity
            : a.itemId.localeCompare(b.itemId),
        ),
    [state.data, search, sort],
  );
  return (
    <Stack>
      <Toolbar search={search} setSearch={setSearch} refresh={refresh}>
        <Select
          value={sort}
          onChange={(v) => setSort(v ?? "item")}
          data={[
            { value: "item", label: "Sort by item" },
            { value: "quantity", label: "Sort by quantity" },
          ]}
        />
      </Toolbar>
      <State
        state={{ ...state, data: items }}
        empty="No inventory items were returned."
      >
        {(data) => (
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Item</Table.Th>
                <Table.Th>Quantity</Table.Th>
                <Table.Th>Container</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.map((item) => (
                <Table.Tr key={`${item.container}-${item.slot}`}>
                  <Table.Td ff="monospace">{item.itemId}</Table.Td>
                  <Table.Td>{item.quantity}</Table.Td>
                  <Table.Td>{item.container}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </State>
    </Stack>
  );
}

function Pals({
  state,
  refresh,
}: {
  state: Loadable<PalDefenderPal[]>;
  refresh: () => Promise<void>;
}) {
  return (
    <Stack>
      <Group justify="flex-end">
        <Button
          variant="light"
          leftSection={<IconRefresh size={16} />}
          onClick={() => void refresh()}
          loading={state.loading}
        >
          Refresh
        </Button>
      </Group>
      <State state={state} empty="No Pals were returned.">
        {(data) => (
          <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }}>
            {data.map((pal) => (
              <Card key={pal.instanceId} withBorder>
                <Group justify="space-between">
                  <Title order={3}>{pal.nickname ?? pal.palId}</Title>
                  <Badge>{pal.location}</Badge>
                </Group>
                <Text c="dimmed" size="sm">
                  {pal.nickname ? pal.palId : "—"}
                </Text>
                <SimpleGrid cols={2} mt="md">
                  <Fact label="Level" value={pal.level} />
                  <Fact label="Gender" value={pal.gender} />
                  <Fact label="Rank" value={pal.rank} />
                  <Fact
                    label="Shiny"
                    value={pal.shiny === null ? null : pal.shiny ? "Yes" : "No"}
                  />
                  <Fact label="Health" value={pal.physicalHealth} />
                  <Fact label="Sanity" value={pal.sanity} />
                  <Fact label="HP" value={pal.hp} />
                  <Fact
                    label="Hunger"
                    value={
                      pal.hunger === null
                        ? null
                        : `${pal.hunger}${pal.maxHunger === null ? "" : ` / ${pal.maxHunger}`}`
                    }
                  />
                  <Fact label="Support" value={pal.support} />
                  <Fact label="Craft speed" value={pal.craftSpeed} />
                </SimpleGrid>
                <Text size="xs" c="dimmed" tt="uppercase" fw={700} mt="md">
                  Passive skills
                </Text>
                <Text>
                  {pal.passiveSkills.length
                    ? pal.passiveSkills.join(", ")
                    : "—"}
                </Text>
                <Text size="xs" c="dimmed" tt="uppercase" fw={700} mt="md">
                  Active skills
                </Text>
                <Text>
                  {pal.activeSkills.length ? pal.activeSkills.join(", ") : "—"}
                </Text>
                <Text size="xs" c="dimmed" tt="uppercase" fw={700} mt="md">
                  Learned skills
                </Text>
                <Text>
                  {pal.learnedSkills.length
                    ? pal.learnedSkills.join(", ")
                    : "—"}
                </Text>
                <Text size="xs" c="dimmed" tt="uppercase" fw={700} mt="md">
                  Pal souls
                </Text>
                <Text>{recordValues(pal.palSouls)}</Text>
                <Text size="xs" c="dimmed" tt="uppercase" fw={700} mt="md">
                  IVs
                </Text>
                <Text>{recordValues(pal.ivs)}</Text>
              </Card>
            ))}
          </SimpleGrid>
        )}
      </State>
    </Stack>
  );
}

function Technology({
  state,
  refresh,
}: {
  state: Loadable<string[]>;
  refresh: () => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const technologies = (state.data ?? [])
    .filter((id) => id.toLowerCase().includes(search.toLowerCase()))
    .sort();
  return (
    <Stack>
      <Toolbar search={search} setSearch={setSearch} refresh={refresh} />
      <State
        state={{ ...state, data: technologies }}
        empty="No unlocked technologies were returned."
      >
        {(data) => (
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            {data.map((id) => (
              <Card key={id} withBorder ff="monospace">
                {id}
              </Card>
            ))}
          </SimpleGrid>
        )}
      </State>
    </Stack>
  );
}

function Toolbar({
  search,
  setSearch,
  refresh,
  children,
}: {
  search: string;
  setSearch: (value: string) => void;
  refresh: () => Promise<void>;
  children?: React.ReactNode;
}) {
  return (
    <Group justify="space-between">
      <Group>
        <TextInput
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          placeholder="Search"
          leftSection={<IconSearch size={16} />}
        />
        {children}
      </Group>
      <Button
        variant="light"
        leftSection={<IconRefresh size={16} />}
        onClick={() => void refresh()}
      >
        Refresh
      </Button>
    </Group>
  );
}
function Fact({
  label,
  value,
}: {
  label: string;
  value: string | number | null;
}) {
  return (
    <div>
      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
        {label}
      </Text>
      <Text>{value ?? "—"}</Text>
    </div>
  );
}

function recordValues(values: Record<string, number>): string {
  const entries = Object.entries(values);
  return entries.length
    ? entries.map(([label, value]) => `${label}: ${value}`).join(", ")
    : "—";
}
