import { type DetailPageSource, isDetailSource } from "./paldefender";

type Resource = "base" | "player" | "guild";

const RESOURCE_TAB: Record<Resource, string> = {
  base: "bases",
  player: "players",
  guild: "guilds",
};

const RESOURCE_LABEL: Record<Resource, string> = {
  base: "Bases",
  player: "Players",
  guild: "Guilds",
};

const SOURCE_TAB: Record<DetailPageSource, string> = {
  map: "map",
  bases: "bases",
  players: "players",
  guilds: "guilds",
  "paldefender-bases": "bases",
  "paldefender-players": "players",
  "paldefender-guilds": "guilds",
};

const SOURCE_LABEL: Record<DetailPageSource, string> = {
  map: "Map",
  bases: "Bases",
  players: "Players",
  guilds: "Guilds",
  "paldefender-bases": "Bases",
  "paldefender-players": "Players",
  "paldefender-guilds": "Guilds",
};

const PALDEFENDER_RESOURCE: Partial<
  Record<DetailPageSource, "bases" | "players" | "guilds">
> = {
  "paldefender-bases": "bases",
  "paldefender-players": "players",
  "paldefender-guilds": "guilds",
};

function isPalDefenderSource(
  source: DetailPageSource,
): source is
  | "paldefender-bases"
  | "paldefender-players"
  | "paldefender-guilds" {
  return source.startsWith("paldefender-");
}

export interface BackTarget {
  href: string;
  label: string;
}

export function detailBackTarget(
  serverId: string,
  resource: Resource,
  fromParam: string | null,
): BackTarget {
  const encodedServerId = encodeURIComponent(serverId);

  if (fromParam && isDetailSource(fromParam)) {
    const source = fromParam;

    if (isPalDefenderSource(source)) {
      const listPath = PALDEFENDER_RESOURCE[source];
      if (listPath) {
        return {
          href: `/paldefender/${listPath}?serverId=${encodedServerId}`,
          label: `Back to ${SOURCE_LABEL[source]}`,
        };
      }
    }

    const tab = SOURCE_TAB[source];
    return {
      href: `/servers/${encodedServerId}?tab=${tab}`,
      label: `Back to ${SOURCE_LABEL[source]}`,
    };
  }

  const tab = RESOURCE_TAB[resource];
  return {
    href: `/servers/${encodedServerId}?tab=${tab}`,
    label: `Back to ${RESOURCE_LABEL[resource]}`,
  };
}

const OPERATED_TABS = new Set([
  "players",
  "guilds",
  "bases",
  "map",
  "audit",
  "administration",
]);

export function normalizeInitialTab(
  tab: string,
  permissions: { canOperate: boolean; canManage: boolean },
): string {
  if (!permissions.canOperate && OPERATED_TABS.has(tab)) {
    return "overview";
  }
  if (!permissions.canManage && tab === "connection") {
    return "overview";
  }
  return tab;
}
