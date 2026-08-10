"use client";

import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  NumberInput,
  Pagination,
  Select,
  SimpleGrid,
  Stack,
  Switch,
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
  IconBan,
  IconChartBar,
  IconGift,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconShieldCheck,
  IconSparkles,
  IconUserMinus,
  IconUser,
  IconTrash,
} from "@tabler/icons-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ApplicationShell } from "./ApplicationShell";
import { BrandedLoader } from "./BrandedLoader";
import { SectionCard } from "./ui/SectionCard";
import { CatalogMultiSelect, CatalogSelect } from "./ui/CatalogSelect";
import {
  catalogLabel,
  eggCatalog,
  findCatalogEntry,
  findPalEntry,
  itemCatalog,
  palCatalog,
  technologyCatalog,
  type CatalogEntry,
} from "../lib/game-catalogs";
import {
  banPalDefenderPlayer,
  getPalDefenderInventory,
  getPalDefenderPals,
  getPalDefenderPlayer,
  getPalDefenderPlayers,
  getPalDefenderProgression,
  givePalDefenderProgression,
  palDefenderRelicTypes,
  getPalDefenderTechnology,
  learnPalDefenderTechnology,
  forgetPalDefenderTechnology,
  givePalDefenderItems,
  givePalDefenderPalEggs,
  givePalDefenderPalTemplates,
  givePalDefenderPals,
  kickPalDefenderPlayer,
  type PalDefenderInventoryItem,
  type PalDefenderPal,
  type PalDefenderPlayerDetails,
  type PalDefenderProgression,
  type PalDefenderProgressionGrant,
  type PalDefenderRelicType,
} from "../lib/api";
import {
  normalizeItemGrants,
  validateItemGrants,
  type ItemGrantInput,
} from "../lib/paldefender-items";
import {
  normalizePalGrant,
  normalizePalEggGrant,
  validatePalEggGrant,
  validatePalGrant,
  validatePalTemplateGrant,
  type PalEggGrantInput,
  type PalGrantInput,
  type PalTemplateGrantInput,
} from "../lib/paldefender-pals";

type TabName =
  | "overview"
  | "inventory"
  | "pals"
  | "technology"
  | "progression"
  | "actions";
type Loadable<T> = { data: T | null; loading: boolean; error: string };
const initial = <T,>(): Loadable<T> => ({
  data: null,
  loading: false,
  error: "",
});
const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Unable to load enhanced player data.";

export function PalDefenderPlayerWorkspace({
  serverId,
  playerId,
  backHref,
}: {
  serverId: string;
  playerId: string;
  backHref: string;
}) {
  const [activeTab, setActiveTab] = useState<TabName>("overview");
  const [player, setPlayer] =
    useState<Loadable<PalDefenderPlayerDetails>>(initial);
  const [inventory, setInventory] =
    useState<Loadable<PalDefenderInventoryItem[]>>(initial);
  const [pals, setPals] = useState<Loadable<PalDefenderPal[]>>(initial);
  const [technology, setTechnology] = useState<Loadable<string[]>>(initial);
  const [progression, setProgression] =
    useState<Loadable<PalDefenderProgression>>(initial);
  const [kickOpened, setKickOpened] = useState(false);
  const [kickMessage, setKickMessage] = useState("");
  const [banOpened, setBanOpened] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [ipBan, setIpBan] = useState(false);
  const [giveItemsOpened, setGiveItemsOpened] = useState(false);
  const [giveItemsConfirmationOpened, setGiveItemsConfirmationOpened] =
    useState(false);
  const [itemGrants, setItemGrants] = useState<ItemGrantInput[]>([
    { itemId: "", count: 1 },
  ]);
  const [itemGrantError, setItemGrantError] = useState("");
  const [givePalOpened, setGivePalOpened] = useState(false);
  const [givePalConfirmationOpened, setGivePalConfirmationOpened] =
    useState(false);
  const [palGrant, setPalGrant] = useState<PalGrantInput>({
    palId: "",
    level: 1,
  });
  const [palGrantError, setPalGrantError] = useState("");
  const [givePalTemplateOpened, setGivePalTemplateOpened] = useState(false);
  const [
    givePalTemplateConfirmationOpened,
    setGivePalTemplateConfirmationOpened,
  ] = useState(false);
  const [palTemplateGrant, setPalTemplateGrant] =
    useState<PalTemplateGrantInput>({ palTemplate: "" });
  const [palTemplateGrantError, setPalTemplateGrantError] = useState("");
  const [givePalEggOpened, setGivePalEggOpened] = useState(false);
  const [givePalEggConfirmationOpened, setGivePalEggConfirmationOpened] =
    useState(false);
  const [palEggGrant, setPalEggGrant] = useState<PalEggGrantInput>({
    mode: "pal-id",
    eggId: "",
    palId: "",
    palTemplate: "",
    level: "",
  });
  const [palEggGrantError, setPalEggGrantError] = useState("");
  const [submittingAction, setSubmittingAction] = useState<
    | "kick"
    | "ban"
    | "give-items"
    | "give-pal"
    | "give-pal-template"
    | "give-pal-egg"
    | null
  >(null);

  const loadPlayer = useCallback(async () => {
    if (!serverId) return;
    setPlayer((value) => ({ ...value, loading: true, error: "" }));
    try {
      setPlayer({
        data: await getPalDefenderPlayer(serverId, playerId),
        loading: false,
        error: "",
      });
    } catch (error) {
      const listedPlayer = await getPalDefenderPlayers(serverId)
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
  }, [playerId, serverId]);
  const loadInventory = useCallback(async () => {
    if (serverId)
      await loadCollection(setInventory, () =>
        getPalDefenderInventory(serverId, playerId),
      );
  }, [playerId, serverId]);
  const loadPals = useCallback(async () => {
    if (serverId)
      await loadCollection(setPals, () =>
        getPalDefenderPals(serverId, playerId),
      );
  }, [playerId, serverId]);
  const loadTechnology = useCallback(async () => {
    if (serverId)
      await loadCollection(setTechnology, () =>
        getPalDefenderTechnology(serverId, playerId),
      );
  }, [playerId, serverId]);
  const loadProgression = useCallback(async () => {
    if (serverId)
      await loadCollection(setProgression, () =>
        getPalDefenderProgression(serverId, playerId),
      );
  }, [playerId, serverId]);

  useEffect(() => {
    setPlayer(initial());
    setInventory(initial());
    setPals(initial());
    setTechnology(initial());
    setProgression(initial());
    void Promise.all([loadPlayer(), loadProgression()]);
  }, [loadPlayer, loadProgression, serverId]);
  useEffect(() => {
    setGivePalTemplateOpened(false);
    setGivePalTemplateConfirmationOpened(false);
    setPalTemplateGrant({ palTemplate: "" });
    setPalTemplateGrantError("");
    setGivePalEggOpened(false);
    setGivePalEggConfirmationOpened(false);
    setPalEggGrant({
      mode: "pal-id",
      eggId: "",
      palId: "",
      palTemplate: "",
      level: "",
    });
    setPalEggGrantError("");
  }, [playerId, serverId]);
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
    if (
      activeTab === "progression" &&
      progression.data === null &&
      !progression.loading &&
      !progression.error
    )
      void loadProgression();
  }, [
    activeTab,
    inventory,
    pals,
    technology,
    progression,
    loadInventory,
    loadPals,
    loadTechnology,
    loadProgression,
  ]);

  const refresh = () => {
    void Promise.all([loadPlayer(), loadProgression()]);
    if (activeTab === "inventory") void loadInventory();
    if (activeTab === "pals") void loadPals();
    if (activeTab === "technology") void loadTechnology();
  };

  const executeModeration = async (options: {
    action: "kick" | "ban";
    execute: () => Promise<unknown>;
    close: () => void;
    reset: () => void;
    successTitle: string;
    successMessage: string;
  }) => {
    if (submittingAction) return;
    setSubmittingAction(options.action);
    try {
      await options.execute();
      options.close();
      options.reset();
      notifications.show({
        color: "green",
        title: options.successTitle,
        message: options.successMessage,
      });
      await Promise.all([loadPlayer(), getPalDefenderPlayers(serverId!)]);
    } catch (error) {
      notifications.show({
        color: "red",
        title: `Unable to ${options.action} player`,
        message:
          error instanceof Error
            ? error.message
            : `PalCenter could not ${options.action} this player.`,
      });
    } finally {
      setSubmittingAction(null);
    }
  };

  const kickPlayer = () =>
    executeModeration({
      action: "kick",
      execute: () => kickPalDefenderPlayer(serverId!, playerId, kickMessage),
      close: () => setKickOpened(false),
      reset: () => setKickMessage(""),
      successTitle: "Player kicked",
      successMessage: `${player.data?.name ?? "The player"} was disconnected from the server.`,
    });

  const banPlayer = () =>
    executeModeration({
      action: "ban",
      execute: () =>
        banPalDefenderPlayer(serverId!, playerId, { reason: banReason, ipBan }),
      close: () => setBanOpened(false),
      reset: () => {
        setBanReason("");
        setIpBan(false);
      },
      successTitle: "Player banned",
      successMessage: `${player.data?.name ?? "The player"} was banned from the server.`,
    });

  const reviewItemGrant = () => {
    const error = validateItemGrants(itemGrants);
    setItemGrantError(error ?? "");
    if (!error) setGiveItemsConfirmationOpened(true);
  };

  const giveItems = async () => {
    if (submittingAction) return;
    const grants = normalizeItemGrants(itemGrants);
    setSubmittingAction("give-items");
    try {
      const result = await givePalDefenderItems(serverId!, playerId, grants);
      setGiveItemsConfirmationOpened(false);
      setGiveItemsOpened(false);
      setItemGrants([{ itemId: "", count: 1 }]);
      setItemGrantError("");
      notifications.show({
        color: "green",
        title: grants.length === 1 ? "Item granted" : "Items granted",
        message: `Granted ${result.grantedItems} item units to ${player.data?.name ?? "the player"}.`,
      });
      await Promise.all([
        loadInventory(),
        loadPlayer(),
        getPalDefenderPlayers(serverId!),
      ]);
    } catch (error) {
      setGiveItemsConfirmationOpened(false);
      notifications.show({
        color: "red",
        title: "Unable to give items",
        message:
          error instanceof Error
            ? error.message
            : "PalCenter could not grant these items.",
      });
    } finally {
      setSubmittingAction(null);
    }
  };

  const reviewPalGrant = () => {
    const error = validatePalGrant(palGrant);
    setPalGrantError(error ?? "");
    if (!error) setGivePalConfirmationOpened(true);
  };

  const givePal = async () => {
    if (submittingAction) return;
    const grant = normalizePalGrant(palGrant);
    setSubmittingAction("give-pal");
    try {
      const result = await givePalDefenderPals(serverId!, playerId, [grant]);
      setGivePalConfirmationOpened(false);
      setGivePalOpened(false);
      setPalGrant({ palId: "", level: 1 });
      setPalGrantError("");
      notifications.show({
        color: "green",
        title: "Pal granted",
        message: `Granted ${result.grantedPals} Pal to ${player.data?.name ?? "the player"}.`,
      });
      await Promise.all([
        loadPals(),
        loadPlayer(),
        getPalDefenderPlayers(serverId!),
      ]);
    } catch (error) {
      setGivePalConfirmationOpened(false);
      notifications.show({
        color: "red",
        title: "Unable to give Pal",
        message:
          error instanceof Error
            ? error.message
            : "PalCenter could not grant this Pal.",
      });
    } finally {
      setSubmittingAction(null);
    }
  };

  const reviewPalTemplateGrant = () => {
    const error = validatePalTemplateGrant(palTemplateGrant);
    setPalTemplateGrantError(error ?? "");
    if (!error) setGivePalTemplateConfirmationOpened(true);
  };

  const givePalTemplate = async () => {
    if (submittingAction) return;
    const template = palTemplateGrant.palTemplate.trim();
    setSubmittingAction("give-pal-template");
    try {
      const result = await givePalDefenderPalTemplates(serverId!, playerId, [
        template,
      ]);
      setGivePalTemplateConfirmationOpened(false);
      setGivePalTemplateOpened(false);
      setPalTemplateGrant({ palTemplate: "" });
      setPalTemplateGrantError("");
      notifications.show({
        color: "green",
        title: "Template Pal granted",
        message: `Granted ${result.grantedPalTemplates} template Pal to ${player.data?.name ?? "the player"}.`,
      });
      await Promise.all([
        loadPals(),
        loadPlayer(),
        getPalDefenderPlayers(serverId!),
      ]);
    } catch (error) {
      setGivePalTemplateConfirmationOpened(false);
      notifications.show({
        color: "red",
        title: "Unable to give template Pal",
        message:
          error instanceof Error
            ? error.message
            : "PalCenter could not grant this template Pal.",
      });
    } finally {
      setSubmittingAction(null);
    }
  };

  const reviewPalEggGrant = () => {
    const error = validatePalEggGrant(palEggGrant);
    setPalEggGrantError(error ?? "");
    if (!error) setGivePalEggConfirmationOpened(true);
  };

  const givePalEgg = async () => {
    if (submittingAction) return;
    const grant = normalizePalEggGrant(palEggGrant);
    setSubmittingAction("give-pal-egg");
    try {
      const result = await givePalDefenderPalEggs(serverId!, playerId, [grant]);
      setGivePalEggConfirmationOpened(false);
      setGivePalEggOpened(false);
      setPalEggGrant({
        mode: "pal-id",
        eggId: "",
        palId: "",
        palTemplate: "",
        level: "",
      });
      setPalEggGrantError("");
      notifications.show({
        color: "green",
        title: "Pal egg granted",
        message: `Granted ${result.grantedPalEggs} Pal egg to ${player.data?.name ?? "the player"}.`,
      });
      await Promise.all([
        loadPals(),
        loadPlayer(),
        getPalDefenderPlayers(serverId!),
      ]);
    } catch (error) {
      setGivePalEggConfirmationOpened(false);
      notifications.show({
        color: "red",
        title: "Unable to give Pal egg",
        message:
          error instanceof Error
            ? error.message
            : "PalCenter could not grant this Pal egg.",
      });
    } finally {
      setSubmittingAction(null);
    }
  };

  return (
    <ApplicationShell>
      <Stack gap="xl">
        <Group justify="space-between" align="flex-start">
          <Stack gap="sm">
            <Button
              component={Link}
              href={backHref}
              variant="subtle"
              leftSection={<IconArrowLeft size={17} />}
              w="fit-content"
              px={0}
            >
              Back to Players
            </Button>
            <Text size="xs" tt="uppercase" fw={700} c="cyan.4" lts={1.4}>
              Player Workspace
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
                value="progression"
                leftSection={<IconChartBar size={16} />}
              >
                Progression
              </Tabs.Tab>
              <Tabs.Tab
                value="actions"
                leftSection={<IconUserMinus size={16} />}
              >
                Actions
              </Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="overview" pt="xl">
              <Overview state={player} progression={progression} />
            </Tabs.Panel>
            <Tabs.Panel value="inventory" pt="xl">
              <Inventory
                state={inventory}
                refresh={loadInventory}
                onGiveItems={() => setGiveItemsOpened(true)}
              />
            </Tabs.Panel>
            <Tabs.Panel value="pals" pt="xl">
              <Stack gap="lg">
                <Group>
                  <Button
                    leftSection={<IconSparkles size={18} />}
                    onClick={() => setGivePalOpened(true)}
                  >
                    Give Pal
                  </Button>
                  <Button
                    variant="light"
                    leftSection={<IconSparkles size={18} />}
                    onClick={() => setGivePalTemplateOpened(true)}
                  >
                    Give Pal from Template
                  </Button>
                  <Button
                    variant="light"
                    leftSection={<IconGift size={18} />}
                    onClick={() => setGivePalEggOpened(true)}
                  >
                    Give Pal Egg
                  </Button>
                </Group>
                <Pals state={pals} refresh={loadPals} />
              </Stack>
            </Tabs.Panel>
            <Tabs.Panel value="technology" pt="xl">
              <Technology
                state={technology}
                refresh={loadTechnology}
                serverId={serverId}
                playerId={playerId}
                playerName={player.data?.name ?? "Player"}
              />
            </Tabs.Panel>
            <Tabs.Panel value="progression" pt="xl">
              <Progression
                state={progression}
                refresh={loadProgression}
                serverId={serverId}
                playerId={playerId}
                playerName={player.data?.name ?? "The player"}
              />
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
                <div>
                  <Title order={3}>Ban Player</Title>
                  <Text c="dimmed" size="sm">
                    Prevent this player from reconnecting to the server.
                  </Text>
                </div>
                <Button
                  color="red"
                  variant="outline"
                  leftSection={<IconBan size={18} />}
                  onClick={() => setBanOpened(true)}
                  w="fit-content"
                >
                  Ban Player
                </Button>
              </Stack>
            </Tabs.Panel>
          </Tabs>
        </SectionCard>
      </Stack>
      <ModerationModal
        opened={kickOpened}
        onClose={() => setKickOpened(false)}
        title="Kick Player"
        playerName={player.data?.name}
        description="will be immediately disconnected from the server."
        reasonLabel="Optional message"
        reasonDescription="PalDefender will use this as the kick reason."
        reasonPlaceholder="Explain why the player is being disconnected"
        reason={kickMessage}
        setReason={setKickMessage}
        submitting={submittingAction === "kick"}
        submitLabel="Kick Player"
        submitIcon={<IconUserMinus size={18} />}
        onSubmit={() => void kickPlayer()}
      />
      <ModerationModal
        opened={banOpened}
        onClose={() => setBanOpened(false)}
        title="Ban Player"
        playerName={player.data?.name}
        description="will be banned and prevented from reconnecting to the server."
        reasonLabel="Reason"
        reasonDescription="Optional. Recorded by PalDefender with the ban."
        reasonPlaceholder="Explain why the player is being banned"
        reason={banReason}
        setReason={setBanReason}
        submitting={submittingAction === "ban"}
        submitLabel="Ban Player"
        submitIcon={<IconBan size={18} />}
        onSubmit={() => void banPlayer()}
      >
        <Switch
          label="IP Ban"
          description="Also ban the player's resolved IP address."
          checked={ipBan}
          onChange={(event) => setIpBan(event.currentTarget.checked)}
          disabled={submittingAction === "ban"}
        />
      </ModerationModal>
      <Modal
        opened={giveItemsOpened}
        onClose={() => {
          if (!submittingAction) setGiveItemsOpened(false);
        }}
        title="Give Item"
        centered
        size="lg"
        closeOnClickOutside={!submittingAction}
        closeOnEscape={!submittingAction}
      >
        <Stack>
          <Text>
            Recipient:{" "}
            <Text span fw={700}>
              {player.data?.name ?? playerId}
            </Text>
          </Text>
          <Text size="sm" c="dimmed">
            Search by item name or internal ID. PalCenter sends the selected
            internal ID to PalDefender.
          </Text>
          {itemGrants.map((grant, index) => (
            <Group key={index} align="flex-end" wrap="nowrap">
              <CatalogSelect
                catalog={itemCatalog}
                label="Item"
                placeholder="Search items"
                value={grant.itemId}
                disabled={Boolean(submittingAction)}
                onChange={(value) => {
                  setItemGrants((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, itemId: value } : item,
                    ),
                  );
                }}
                style={{ flex: 1 }}
              />
              <NumberInput
                label="Quantity"
                min={1}
                step={1}
                allowDecimal={false}
                value={grant.count}
                disabled={Boolean(submittingAction)}
                onChange={(value) =>
                  setItemGrants((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, count: value } : item,
                    ),
                  )
                }
                w={130}
              />
              <Button
                variant="subtle"
                color="red"
                aria-label={`Remove item ${index + 1}`}
                disabled={itemGrants.length === 1 || Boolean(submittingAction)}
                onClick={() =>
                  setItemGrants((current) =>
                    current.filter((_, itemIndex) => itemIndex !== index),
                  )
                }
              >
                <IconTrash size={18} />
              </Button>
            </Group>
          ))}
          <Button
            variant="subtle"
            leftSection={<IconPlus size={17} />}
            w="fit-content"
            disabled={Boolean(submittingAction)}
            onClick={() =>
              setItemGrants((current) => [...current, { itemId: "", count: 1 }])
            }
          >
            Add Item
          </Button>
          {itemGrantError && <Alert color="red">{itemGrantError}</Alert>}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setGiveItemsOpened(false)}>
              Cancel
            </Button>
            <Button
              leftSection={<IconGift size={18} />}
              onClick={reviewItemGrant}
            >
              Review Grant
            </Button>
          </Group>
        </Stack>
      </Modal>
      <Modal
        opened={giveItemsConfirmationOpened}
        onClose={() => {
          if (!submittingAction) setGiveItemsConfirmationOpened(false);
        }}
        title={
          itemGrants.length === 1 ? "Confirm Item Grant" : "Confirm Item Grants"
        }
        centered
        closeOnClickOutside={!submittingAction}
        closeOnEscape={!submittingAction}
      >
        <Stack>
          <Text>
            Give the following to{" "}
            <Text span fw={700}>
              {player.data?.name ?? playerId}
            </Text>
            ?
          </Text>
          {normalizeItemGrants(itemGrants).map((grant) => (
            <Text key={`${grant.itemId}-${grant.count}`} ff="monospace">
              {grant.count} × {grant.itemId}
            </Text>
          ))}
          <Group justify="flex-end">
            <Button
              variant="default"
              disabled={submittingAction === "give-items"}
              onClick={() => setGiveItemsConfirmationOpened(false)}
            >
              Cancel
            </Button>
            <Button
              leftSection={<IconGift size={18} />}
              loading={submittingAction === "give-items"}
              disabled={submittingAction === "give-items"}
              onClick={() => void giveItems()}
            >
              {itemGrants.length === 1 ? "Give Item" : "Give Items"}
            </Button>
          </Group>
        </Stack>
      </Modal>
      <Modal
        opened={givePalOpened}
        onClose={() => {
          if (!submittingAction) setGivePalOpened(false);
        }}
        title="Give Pal"
        centered
        closeOnClickOutside={!submittingAction}
        closeOnEscape={!submittingAction}
      >
        <Stack>
          <Text>
            Recipient:{" "}
            <Text span fw={700}>
              {player.data?.name ?? playerId}
            </Text>
          </Text>
          <CatalogSelect
            catalog={palCatalog}
            label="Pal"
            placeholder="Search Pals"
            description="PalCenter sends the selected internal Pal ID to PalDefender."
            value={palGrant.palId}
            disabled={Boolean(submittingAction)}
            onChange={(value) => {
              setPalGrant((current) => ({
                ...current,
                palId: value,
              }));
            }}
          />
          <NumberInput
            label="Level"
            min={1}
            step={1}
            allowDecimal={false}
            value={palGrant.level}
            disabled={Boolean(submittingAction)}
            onChange={(value) =>
              setPalGrant((current) => ({ ...current, level: value }))
            }
          />
          {palGrantError && <Alert color="red">{palGrantError}</Alert>}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setGivePalOpened(false)}>
              Cancel
            </Button>
            <Button
              leftSection={<IconSparkles size={18} />}
              onClick={reviewPalGrant}
            >
              Review Grant
            </Button>
          </Group>
        </Stack>
      </Modal>
      <Modal
        opened={givePalConfirmationOpened}
        onClose={() => {
          if (!submittingAction) setGivePalConfirmationOpened(false);
        }}
        title="Confirm Pal Grant"
        centered
        closeOnClickOutside={!submittingAction}
        closeOnEscape={!submittingAction}
      >
        <Stack>
          <Text>
            Give this Pal to{" "}
            <Text span fw={700}>
              {player.data?.name ?? playerId}
            </Text>
            ?
          </Text>
          <Text ff="monospace">
            Pal ID: {normalizePalGrant(palGrant).palId}
          </Text>
          <Text ff="monospace">Level: {normalizePalGrant(palGrant).level}</Text>
          <Group justify="flex-end">
            <Button
              variant="default"
              disabled={submittingAction === "give-pal"}
              onClick={() => setGivePalConfirmationOpened(false)}
            >
              Cancel
            </Button>
            <Button
              leftSection={<IconSparkles size={18} />}
              loading={submittingAction === "give-pal"}
              disabled={submittingAction === "give-pal"}
              onClick={() => void givePal()}
            >
              Give Pal
            </Button>
          </Group>
        </Stack>
      </Modal>
      <Modal
        opened={givePalTemplateOpened}
        onClose={() => {
          if (!submittingAction) setGivePalTemplateOpened(false);
        }}
        title="Give Pal from Template"
        centered
        closeOnClickOutside={!submittingAction}
        closeOnEscape={!submittingAction}
      >
        <Stack>
          <Text>
            Recipient:{" "}
            <Text span fw={700}>
              {player.data?.name ?? playerId}
            </Text>
          </Text>
          <Text size="sm" c="dimmed">
            Enter a template filename already installed in PalDefender’s
            Pals/Templates folder. PalDefender does not provide a REST endpoint
            for listing available templates.
          </Text>
          <TextInput
            label="Template filename"
            placeholder="For example: starter_pengullet.json"
            value={palTemplateGrant.palTemplate}
            disabled={Boolean(submittingAction)}
            onChange={(event) =>
              setPalTemplateGrant({ palTemplate: event.currentTarget.value })
            }
          />
          {palTemplateGrantError && (
            <Alert color="red">{palTemplateGrantError}</Alert>
          )}
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => setGivePalTemplateOpened(false)}
            >
              Cancel
            </Button>
            <Button onClick={reviewPalTemplateGrant}>Review Grant</Button>
          </Group>
        </Stack>
      </Modal>
      <Modal
        opened={givePalTemplateConfirmationOpened}
        onClose={() => {
          if (!submittingAction) setGivePalTemplateConfirmationOpened(false);
        }}
        title="Confirm Template Pal Grant"
        centered
        closeOnClickOutside={!submittingAction}
        closeOnEscape={!submittingAction}
      >
        <Stack>
          <Text>
            Give one Pal from this server template to{" "}
            <Text span fw={700}>
              {player.data?.name ?? playerId}
            </Text>
            ?
          </Text>
          <Text ff="monospace">
            Template: {palTemplateGrant.palTemplate.trim()}
          </Text>
          <Group justify="flex-end">
            <Button
              variant="default"
              disabled={submittingAction === "give-pal-template"}
              onClick={() => setGivePalTemplateConfirmationOpened(false)}
            >
              Cancel
            </Button>
            <Button
              loading={submittingAction === "give-pal-template"}
              disabled={submittingAction === "give-pal-template"}
              onClick={() => void givePalTemplate()}
            >
              Give Template Pal
            </Button>
          </Group>
        </Stack>
      </Modal>
      <Modal
        opened={givePalEggOpened}
        onClose={() => {
          if (!submittingAction) setGivePalEggOpened(false);
        }}
        title="Give Pal Egg"
        centered
        closeOnClickOutside={!submittingAction}
        closeOnEscape={!submittingAction}
      >
        <Stack>
          <Text>
            Recipient:{" "}
            <Text span fw={700}>
              {player.data?.name ?? playerId}
            </Text>
          </Text>
          <Select
            label="Egg contents"
            data={[
              { value: "pal-id", label: "Pal ID" },
              { value: "template", label: "Pal template" },
            ]}
            value={palEggGrant.mode}
            disabled={Boolean(submittingAction)}
            allowDeselect={false}
            onChange={(value) =>
              setPalEggGrant((current) => ({
                ...current,
                mode: value === "template" ? "template" : "pal-id",
              }))
            }
          />
          <CatalogSelect
            catalog={eggCatalog}
            label="Egg"
            placeholder="Search eggs"
            description="Only valid Pal egg items are shown."
            value={palEggGrant.eggId}
            disabled={Boolean(submittingAction)}
            onChange={(value) => {
              setPalEggGrant((current) => ({
                ...current,
                eggId: value,
              }));
            }}
          />
          {palEggGrant.mode === "pal-id" ? (
            <>
              <CatalogSelect
                catalog={palCatalog}
                label="Pal inside egg"
                placeholder="Search Pals"
                description="PalCenter sends the selected internal Pal ID to PalDefender."
                value={palEggGrant.palId}
                disabled={Boolean(submittingAction)}
                onChange={(value) => {
                  setPalEggGrant((current) => ({
                    ...current,
                    palId: value,
                  }));
                }}
              />
            </>
          ) : (
            <TextInput
              label="Pal template filename"
              placeholder="For example: dark_event_reward.json"
              value={palEggGrant.palTemplate}
              disabled={Boolean(submittingAction)}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setPalEggGrant((current) => ({
                  ...current,
                  palTemplate: value,
                }));
              }}
            />
          )}
          <NumberInput
            label="Level (optional)"
            min={1}
            step={1}
            allowDecimal={false}
            value={palEggGrant.level}
            disabled={Boolean(submittingAction)}
            onChange={(value) =>
              setPalEggGrant((current) => ({ ...current, level: value }))
            }
          />
          {palEggGrantError && <Alert color="red">{palEggGrantError}</Alert>}
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => setGivePalEggOpened(false)}
            >
              Cancel
            </Button>
            <Button onClick={reviewPalEggGrant}>Review Grant</Button>
          </Group>
        </Stack>
      </Modal>
      <Modal
        opened={givePalEggConfirmationOpened}
        onClose={() => {
          if (!submittingAction) setGivePalEggConfirmationOpened(false);
        }}
        title="Confirm Pal Egg Grant"
        centered
        closeOnClickOutside={!submittingAction}
        closeOnEscape={!submittingAction}
      >
        <Stack>
          <Text>
            Give one Pal egg to{" "}
            <Text span fw={700}>
              {player.data?.name ?? playerId}
            </Text>
            ?
          </Text>
          <Text ff="monospace">Egg ID: {palEggGrant.eggId.trim()}</Text>
          <Text ff="monospace">
            {palEggGrant.mode === "pal-id"
              ? `Pal ID: ${palEggGrant.palId.trim()}`
              : `Template: ${palEggGrant.palTemplate.trim()}`}
          </Text>
          <Text ff="monospace">
            Level:{" "}
            {palEggGrant.level === ""
              ? "PalDefender default"
              : palEggGrant.level}
          </Text>
          <Group justify="flex-end">
            <Button
              variant="default"
              disabled={submittingAction === "give-pal-egg"}
              onClick={() => setGivePalEggConfirmationOpened(false)}
            >
              Cancel
            </Button>
            <Button
              loading={submittingAction === "give-pal-egg"}
              disabled={submittingAction === "give-pal-egg"}
              onClick={() => void givePalEgg()}
            >
              Give Pal Egg
            </Button>
          </Group>
        </Stack>
      </Modal>
    </ApplicationShell>
  );
}

function ModerationModal({
  opened,
  onClose,
  title,
  playerName,
  description,
  reasonLabel,
  reasonDescription,
  reasonPlaceholder,
  reason,
  setReason,
  submitting,
  submitLabel,
  submitIcon,
  onSubmit,
  children,
}: {
  opened: boolean;
  onClose: () => void;
  title: string;
  playerName?: string;
  description: string;
  reasonLabel: string;
  reasonDescription: string;
  reasonPlaceholder: string;
  reason: string;
  setReason: (value: string) => void;
  submitting: boolean;
  submitLabel: string;
  submitIcon: React.ReactNode;
  onSubmit: () => void;
  children?: React.ReactNode;
}) {
  return (
    <Modal
      opened={opened}
      onClose={() => {
        if (!submitting) onClose();
      }}
      title={title}
      centered
      closeOnClickOutside={!submitting}
      closeOnEscape={!submitting}
    >
      <Stack>
        <Text>
          <Text span fw={700}>
            {playerName ?? "This player"}
          </Text>{" "}
          {description}
        </Text>
        <Textarea
          label={reasonLabel}
          description={reasonDescription}
          placeholder={reasonPlaceholder}
          minRows={4}
          maxLength={2_000}
          value={reason}
          onChange={(event) => setReason(event.currentTarget.value)}
          disabled={submitting}
        />
        {children}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            color="red"
            leftSection={submitIcon}
            loading={submitting}
            disabled={submitting}
            onClick={onSubmit}
          >
            {submitLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
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
    return <BrandedLoader message="Loading enhanced player data" />;
  if (state.error) return <Alert color="red">{state.error}</Alert>;
  if (!state.data?.length)
    return (
      <Text ta="center" c="dimmed" py="xl">
        {empty}
      </Text>
    );
  return children(state.data);
}

function Overview({
  state,
  progression,
}: {
  state: Loadable<PalDefenderPlayerDetails>;
  progression: Loadable<PalDefenderProgression>;
}) {
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
    ["Level", progression.data?.character.level ?? p.level],
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
  onGiveItems,
}: {
  state: Loadable<PalDefenderInventoryItem[]>;
  refresh: () => Promise<void>;
  onGiveItems: () => void;
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
      <Group justify="space-between" align="end">
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
        <Button leftSection={<IconGift size={16} />} onClick={onGiveItems}>
          Give Item
        </Button>
      </Group>
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
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState("12");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const all = state.data ?? [];
  const filtered = all.filter((pal) =>
    [pal.nickname, pal.palId, pal.location, ...pal.passiveSkills].some(
      (value) => value?.toLowerCase().includes(search.trim().toLowerCase()),
    ),
  );
  const size = Number(pageSize);
  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * size, currentPage * size);
  const selected = all.find((pal) => pal.instanceId === selectedId) ?? null;
  useEffect(() => setPage(1), [search, pageSize]);
  if (selected) {
    return (
      <Stack>
        <Button
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => setSelectedId(null)}
          w="fit-content"
        >
          Back to Pals
        </Button>
        <SectionCard>
          <Stack gap="lg">
            <Group justify="space-between">
              <div>
                {(() => {
                  const entry = findPalEntry(selected.palId);
                  return (
                    <Title order={2}>
                      {entry ? catalogLabel(entry) : selected.palId}
                    </Title>
                  );
                })()}
                <Text c="dimmed" ff="monospace">
                  {selected.palId}
                </Text>
              </div>
              <Badge>{selected.location}</Badge>
            </Group>
            {selected.nickname && (
              <Fact label="Nickname" value={selected.nickname} />
            )}
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
              <Fact label="Level" value={selected.level} />
              <Fact label="Gender" value={selected.gender} />
              <Fact label="Rank" value={selected.rank} />
              <Fact label="Experience" value={selected.experience} />
              <Fact label="Health" value={selected.physicalHealth} />
              <Fact label="HP" value={selected.hp} />
              <Fact label="Sanity" value={selected.sanity} />
              <Fact label="Hunger" value={selected.hunger} />
              <Fact label="Support" value={selected.support} />
              <Fact label="Craft speed" value={selected.craftSpeed} />
              <Fact
                label="Shiny"
                value={
                  selected.shiny === null ? null : selected.shiny ? "Yes" : "No"
                }
              />
              <Fact label="Base Camp ID" value={selected.baseCampId} />
            </SimpleGrid>
            <div>
              <Text fw={700}>Passive skills</Text>
              <Text>{selected.passiveSkills.join(", ") || "—"}</Text>
            </div>
            <div>
              <Text fw={700}>Active skills</Text>
              <Text>{selected.activeSkills.join(", ") || "—"}</Text>
            </div>
            <div>
              <Text fw={700}>Learned skills</Text>
              <Text>{selected.learnedSkills.join(", ") || "—"}</Text>
            </div>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <Fact label="Pal souls" value={recordValues(selected.palSouls)} />
              <Fact label="IVs" value={recordValues(selected.ivs)} />
            </SimpleGrid>
          </Stack>
        </SectionCard>
      </Stack>
    );
  }
  return (
    <Stack>
      <Group justify="space-between" align="end">
        <TextInput
          label="Search Pals"
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
        />
        <Group>
          <Select
            label="Per page"
            data={["12", "24", "48", "96"]}
            value={pageSize}
            onChange={(value) => setPageSize(value ?? "12")}
          />
          <Button
            variant="light"
            leftSection={<IconRefresh size={16} />}
            onClick={() => void refresh()}
            loading={state.loading}
          >
            Refresh
          </Button>
        </Group>
      </Group>
      <State state={state} empty="No Pals were returned.">
        {() => (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3, xl: 4 }}>
            {visible.map((pal) => (
              <Card
                key={pal.instanceId}
                withBorder
                component="button"
                onClick={() => setSelectedId(pal.instanceId)}
                style={{ cursor: "pointer", textAlign: "left" }}
              >
                <Group justify="space-between">
                  <Title order={3}>
                    {(() => {
                      const entry = findPalEntry(pal.palId);
                      return entry ? catalogLabel(entry) : pal.palId;
                    })()}
                  </Title>
                  <Badge>{pal.location}</Badge>
                </Group>
                <Text c="dimmed" size="sm">
                  {pal.palId}
                </Text>
                <SimpleGrid cols={3} mt="sm">
                  <Fact label="Level" value={pal.level} />
                  <Fact label="Gender" value={pal.gender} />
                  <Fact label="Rank" value={pal.rank} />
                </SimpleGrid>
                <Text size="sm" c="dimmed" mt="sm" lineClamp={2}>
                  {pal.passiveSkills.length
                    ? pal.passiveSkills.join(", ")
                    : "No passive skills returned"}
                </Text>
              </Card>
            ))}
          </SimpleGrid>
        )}
      </State>
      {filtered.length === 0 && state.data && (
        <Text ta="center" c="dimmed">
          No Pals match your search.
        </Text>
      )}
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          {filtered.length
            ? `${(currentPage - 1) * size + 1}–${Math.min(currentPage * size, filtered.length)} of ${filtered.length}`
            : "0 Pals"}
        </Text>
        {pages > 1 && (
          <Pagination value={currentPage} onChange={setPage} total={pages} />
        )}
      </Group>
    </Stack>
  );
}

function Technology({
  state,
  refresh,
  serverId,
  playerId,
  playerName,
}: {
  state: Loadable<string[]>;
  refresh: () => Promise<void>;
  serverId: string;
  playerId: string;
  playerName: string;
}) {
  const [search, setSearch] = useState("");
  const [action, setAction] = useState<"learn" | "forget" | null>(null);
  const [scope, setScope] = useState<"selected" | "all">("selected");
  const [learnIds, setLearnIds] = useState<string[]>([]);
  const [forgetIds, setForgetIds] = useState<string[]>([]);
  const [confirmationOpened, setConfirmationOpened] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");
  const [actionError, setActionError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const technologies = (state.data ?? [])
    .filter((id) => id.toLowerCase().includes(search.toLowerCase()))
    .sort();
  const selectedIds = action === "forget" ? forgetIds : learnIds;
  const unlockedTechnologyCatalog = (state.data ?? []).map(
    (id): CatalogEntry =>
      findCatalogEntry(technologyCatalog, id) ?? { id, name: id },
  );
  const resetAction = () => {
    setAction(null);
    setScope("selected");
    setLearnIds([]);
    setForgetIds([]);
    setConfirmationOpened(false);
    setConfirmationText("");
    setActionError("");
  };
  useEffect(() => {
    setAction(null);
    setScope("selected");
    setLearnIds([]);
    setForgetIds([]);
    setConfirmationOpened(false);
    setConfirmationText("");
    setActionError("");
    setSubmitting(false);
  }, [playerId, serverId]);
  const reviewAction = () => {
    if (scope === "selected") {
      if (!selectedIds.length) {
        setActionError("Select or enter at least one technology ID.");
        return;
      }
      if (
        selectedIds.some(
          (id) => id === "All" || !/^[A-Za-z0-9_]{1,256}$/.test(id),
        )
      ) {
        setActionError(
          'Technology IDs may contain letters, numbers, and underscores. "All" cannot be included in a selection.',
        );
        return;
      }
    }
    setActionError("");
    setConfirmationOpened(true);
  };
  const submitAction = async () => {
    if (!action || submitting) return;
    if (
      action === "forget" &&
      scope === "all" &&
      confirmationText !== "FORGET ALL"
    ) {
      setActionError('Type "FORGET ALL" exactly to continue.');
      return;
    }
    setSubmitting(true);
    const mutation =
      scope === "all"
        ? ({ scope: "all" } as const)
        : ({ scope: "selected", technologyIds: selectedIds } as const);
    try {
      const result =
        action === "learn"
          ? await learnPalDefenderTechnology(serverId, playerId, mutation)
          : await forgetPalDefenderTechnology(serverId, playerId, mutation);
      notifications.show({
        color: "green",
        title:
          action === "learn" ? "Technology learned" : "Technology forgotten",
        message: `${result.changedCount} technolog${result.changedCount === 1 ? "y" : "ies"} changed. Refreshing authoritative state.`,
      });
      await refresh();
      resetAction();
    } catch (error) {
      const detail = message(error);
      setActionError(detail);
      notifications.show({
        color: "red",
        title:
          action === "learn"
            ? "Unable to learn technology"
            : "Unable to forget technology",
        message: detail,
      });
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <Stack>
      <Group justify="space-between" align="end">
        <Toolbar search={search} setSearch={setSearch} refresh={refresh} />
        <Group>
          <Button variant="light" onClick={() => setAction("learn")}>
            Learn Technology
          </Button>
          <Button
            color="red"
            variant="light"
            onClick={() => setAction("forget")}
          >
            Forget Technology
          </Button>
        </Group>
      </Group>
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
      <Modal
        opened={action !== null && !confirmationOpened}
        onClose={resetAction}
        title={action === "learn" ? "Learn Technology" : "Forget Technology"}
      >
        <Stack>
          <Text size="sm">
            {action === "learn"
              ? "Unlock technologies for"
              : "Remove unlocked technologies from"}{" "}
            <strong>{playerName}</strong>.
          </Text>
          <Select
            label="Scope"
            value={scope}
            onChange={(value) => setScope(value === "all" ? "all" : "selected")}
            data={[
              { value: "selected", label: "Selected technologies" },
              {
                value: "all",
                label:
                  action === "learn"
                    ? "All technologies"
                    : "Forget all technologies",
              },
            ]}
          />
          {scope === "all" ? (
            <Alert color={action === "forget" ? "red" : "orange"}>
              {action === "forget"
                ? "This removes every unlocked technology from the player. This is a destructive, account-wide operation."
                : "This unlocks every technology supported by the server for this player."}
            </Alert>
          ) : action === "forget" ? (
            <CatalogMultiSelect
              catalog={unlockedTechnologyCatalog}
              label="Unlocked technologies"
              description="Select one or more technologies currently unlocked for this player."
              value={forgetIds}
              onChange={setForgetIds}
            />
          ) : (
            <CatalogMultiSelect
              catalog={technologyCatalog}
              label="Technologies"
              description="Search by technology name or internal ID."
              value={learnIds}
              onChange={setLearnIds}
              placeholder="Search technologies"
            />
          )}
          {actionError && <Alert color="red">{actionError}</Alert>}
          <Group justify="flex-end">
            <Button variant="default" onClick={resetAction}>
              Cancel
            </Button>
            <Button
              color={action === "forget" ? "red" : "blue"}
              onClick={reviewAction}
            >
              Continue
            </Button>
          </Group>
        </Stack>
      </Modal>
      <Modal
        opened={confirmationOpened}
        onClose={() => !submitting && setConfirmationOpened(false)}
        title={`Confirm ${action === "learn" ? "Learn Technology" : "Forget Technology"}`}
      >
        <Stack>
          <Text>
            {action === "learn" ? "Learn" : "Forget"}{" "}
            <strong>
              {scope === "all"
                ? "all technologies"
                : `${selectedIds.length} selected technolog${selectedIds.length === 1 ? "y" : "ies"}`}
            </strong>{" "}
            for <strong>{playerName}</strong>?
          </Text>
          {scope === "selected" && (
            <Text size="sm" ff="monospace">
              {selectedIds.join(", ")}
            </Text>
          )}
          {action === "forget" && scope === "all" && (
            <TextInput
              label='Type "FORGET ALL" to confirm'
              value={confirmationText}
              onChange={(event) =>
                setConfirmationText(event.currentTarget.value)
              }
              error={actionError || undefined}
            />
          )}
          {actionError && !(action === "forget" && scope === "all") && (
            <Alert color="red">{actionError}</Alert>
          )}
          <Group justify="flex-end">
            <Button
              variant="default"
              disabled={submitting}
              onClick={() => setConfirmationOpened(false)}
            >
              Back
            </Button>
            <Button
              color={action === "forget" ? "red" : "blue"}
              loading={submitting}
              disabled={
                submitting ||
                (action === "forget" &&
                  scope === "all" &&
                  confirmationText !== "FORGET ALL")
              }
              onClick={() => void submitAction()}
            >
              {action === "learn" ? "Learn Technology" : "Forget Technology"}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

function Progression({
  state,
  refresh,
  serverId,
  playerId,
  playerName,
}: {
  state: Loadable<PalDefenderProgression>;
  refresh: () => Promise<void>;
  serverId: string;
  playerId: string;
  playerName: string;
}) {
  const [search, setSearch] = useState("");
  const [grantOpened, setGrantOpened] = useState(false);
  const [confirmationOpened, setConfirmationOpened] = useState(false);
  const [grantType, setGrantType] =
    useState<PalDefenderProgressionGrant["type"]>("experience");
  const [relicType, setRelicType] =
    useState<PalDefenderRelicType>("CapturePower");
  const [amount, setAmount] = useState<number | string>(1);
  const [grantError, setGrantError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const amountValue = typeof amount === "number" ? amount : Number(amount);
  const grant: PalDefenderProgressionGrant =
    grantType === "relic"
      ? { type: "relic", relicType, amount: amountValue }
      : { type: grantType, amount: amountValue };
  const label = progressionGrantLabel(grant);
  const reviewGrant = () => {
    if (!Number.isSafeInteger(amountValue) || amountValue <= 0) {
      setGrantError("Enter a positive whole number.");
      return;
    }
    setGrantError("");
    setConfirmationOpened(true);
  };
  const submitGrant = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await givePalDefenderProgression(serverId, playerId, grant);
      await refresh();
      setConfirmationOpened(false);
      setGrantOpened(false);
      setAmount(1);
      setGrantError("");
      notifications.show({
        color: "green",
        title: "Progression granted",
        message: `Granted ${label} to ${playerName}.`,
      });
    } catch (error) {
      setConfirmationOpened(false);
      notifications.show({
        color: "red",
        title: "Unable to grant progression",
        message:
          error instanceof Error
            ? error.message
            : "PalCenter could not grant progression.",
      });
    } finally {
      setSubmitting(false);
    }
  };
  if (state.loading && !state.data)
    return <BrandedLoader message="Loading player progression" />;
  if (state.error)
    return (
      <Stack>
        <Alert color="red" title="Progression unavailable">
          {state.error}
        </Alert>
        <Button onClick={() => void refresh()} w="fit-content">
          Try again
        </Button>
      </Stack>
    );
  if (!state.data)
    return (
      <Text ta="center" c="dimmed" py="xl">
        No progression data was returned.
      </Text>
    );
  const value = state.data;
  const collections: Array<{
    title: string;
    values: Record<string, number | boolean>;
  }> = [
    { title: "Relics", values: value.currencies.relics },
    { title: "Pal captures", values: value.captures.byPal },
    { title: "Capture bonuses", values: value.captures.bonusesByPal },
    { title: "Pals butchered", values: value.captures.butcheredByPal },
    { title: "Tower bosses", values: value.bosses.towerDefeats },
    { title: "Normal bosses", values: value.bosses.normalDefeatFlags },
    { title: "Raid bosses", values: value.bosses.raidDefeats },
    { title: "Crafted items", values: value.activities.craftedItems },
    { title: "Pal rank-ups", values: value.activities.palRankUps },
    { title: "Solo arenas", values: value.activities.soloArenasCleared },
    { title: "NPC conversations", values: value.activities.npcTalks },
    { title: "Fishing", values: value.activities.fishing },
  ];
  return (
    <Stack gap="xl">
      <Group justify="space-between">
        <TextInput
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          placeholder="Search progression IDs"
          leftSection={<IconSearch size={16} />}
        />
        <Group>
          <Button
            variant="light"
            leftSection={<IconRefresh size={16} />}
            onClick={() => void refresh()}
            loading={state.loading}
          >
            Refresh
          </Button>
          <Button
            leftSection={<IconGift size={16} />}
            onClick={() => setGrantOpened(true)}
          >
            Grant Progression
          </Button>
        </Group>
      </Group>
      <div>
        <Title order={3} mb="sm">
          Character
        </Title>
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <ProgressionFact label="Level" value={value.character.level} />
          <ProgressionFact
            label="Experience"
            value={value.character.experience}
          />
          <ProgressionFact
            label="Unused status points"
            value={value.character.unusedStatusPoints}
          />
        </SimpleGrid>
      </div>
      <div>
        <Title order={3} mb="sm">
          Points and currency
        </Title>
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <ProgressionFact
            label="Technology points"
            value={value.currencies.technologyPoints}
          />
          <ProgressionFact
            label="Ancient technology points"
            value={value.currencies.ancientTechnologyPoints}
          />
          <ProgressionFact
            label="Relic types"
            value={Object.keys(value.currencies.relics).length}
          />
        </SimpleGrid>
      </div>
      <div>
        <Title order={3} mb="sm">
          Captures and bosses
        </Title>
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <ProgressionFact
            label="Total captures"
            value={value.captures.total}
          />
          <ProgressionFact
            label="Boss defeats"
            value={value.bosses.totalDefeats}
          />
          <ProgressionFact
            label="Predator defeats"
            value={value.bosses.predatorDefeats}
          />
        </SimpleGrid>
      </div>
      <div>
        <Title order={3} mb="sm">
          Activities
        </Title>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
          <ProgressionFact
            label="Normal dungeons"
            value={value.activities.normalDungeonsCleared}
          />
          <ProgressionFact
            label="Fixed dungeons"
            value={value.activities.fixedDungeonsCleared}
          />
          <ProgressionFact
            label="Oil rigs"
            value={value.activities.oilRigsCleared}
          />
          <ProgressionFact
            label="Treasures found"
            value={value.activities.treasuresFound}
          />
          <ProgressionFact
            label="Camps conquered"
            value={value.activities.campsConquered}
          />
          <ProgressionFact
            label="First fishing completed"
            value={value.activities.firstFishingCompleted ? "Yes" : "No"}
          />
        </SimpleGrid>
      </div>
      {collections.map((collection) => {
        const entries = Object.entries(collection.values).filter(([id]) =>
          id.toLowerCase().includes(search.trim().toLowerCase()),
        );
        if (!entries.length) return null;
        return (
          <div key={collection.title}>
            <Title order={3} mb="sm">
              {collection.title}
            </Title>
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Internal ID</Table.Th>
                  <Table.Th>Value</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {entries.map(([id, count]) => (
                  <Table.Tr key={id}>
                    <Table.Td ff="monospace">{id}</Table.Td>
                    <Table.Td>
                      {typeof count === "boolean"
                        ? count
                          ? "Completed"
                          : "Not completed"
                        : count}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </div>
        );
      })}
      <Modal
        opened={grantOpened}
        onClose={() => !submitting && setGrantOpened(false)}
        title="Grant Progression"
      >
        <Stack>
          <Text size="sm" c="dimmed">
            Recipient
          </Text>
          <Text fw={700}>{playerName}</Text>
          <Select
            label="Type"
            value={grantType}
            onChange={(value) =>
              setGrantType(
                (value ?? "experience") as PalDefenderProgressionGrant["type"],
              )
            }
            data={[
              { value: "experience", label: "Experience" },
              { value: "technologyPoints", label: "Technology Points" },
              {
                value: "ancientTechnologyPoints",
                label: "Ancient Technology Points",
              },
              { value: "relic", label: "Relic Upgrade" },
            ]}
          />
          {grantType === "relic" && (
            <Select
              label="Relic type"
              searchable
              value={relicType}
              onChange={(value) =>
                setRelicType((value ?? "CapturePower") as PalDefenderRelicType)
              }
              data={palDefenderRelicTypes.map((value) => ({
                value,
                label: relicLabel(value),
              }))}
            />
          )}
          <NumberInput
            label="Amount"
            value={amount}
            onChange={setAmount}
            min={1}
            step={1}
            allowDecimal={false}
            error={grantError || undefined}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setGrantOpened(false)}>
              Cancel
            </Button>
            <Button onClick={reviewGrant}>Continue</Button>
          </Group>
        </Stack>
      </Modal>
      <Modal
        opened={confirmationOpened}
        onClose={() => !submitting && setConfirmationOpened(false)}
        title="Confirm Progression Grant"
      >
        <Stack>
          <Text>
            Grant{" "}
            <Text span fw={700}>
              {label}
            </Text>{" "}
            to {playerName}?
          </Text>
          <Alert color="orange">
            This will permanently modify the player&apos;s progression.
          </Alert>
          <Group justify="flex-end">
            <Button
              variant="default"
              disabled={submitting}
              onClick={() => setConfirmationOpened(false)}
            >
              Cancel
            </Button>
            <Button
              loading={submitting}
              disabled={submitting}
              onClick={() => void submitGrant()}
            >
              Grant
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

function relicLabel(value: PalDefenderRelicType): string {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function progressionGrantLabel(grant: PalDefenderProgressionGrant): string {
  const amount = grant.amount.toLocaleString();
  if (grant.type === "experience") return `${amount} Experience`;
  if (grant.type === "technologyPoints") return `${amount} Technology Points`;
  if (grant.type === "ancientTechnologyPoints")
    return `${amount} Ancient Technology Points`;
  return `${amount} ${relicLabel(grant.relicType)} Relic ${grant.amount === 1 ? "Point" : "Points"}`;
}

function ProgressionFact({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <Card withBorder>
      <Fact label={label} value={value} />
    </Card>
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
