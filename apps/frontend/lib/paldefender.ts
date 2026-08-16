export type DetailPageSource =
  | "map"
  | "bases"
  | "players"
  | "guilds"
  | "paldefender-bases"
  | "paldefender-players"
  | "paldefender-guilds";

const DETAIL_SOURCES = new Set<DetailPageSource>([
  "map",
  "bases",
  "players",
  "guilds",
  "paldefender-bases",
  "paldefender-players",
  "paldefender-guilds",
]);

export function isDetailSource(value: string): value is DetailPageSource {
  return DETAIL_SOURCES.has(value as DetailPageSource);
}

export function palDefenderPlayerHref(
  serverId: string,
  playerId: string,
  source?: DetailPageSource,
): string {
  const base = `/servers/${encodeURIComponent(serverId)}/players/${encodeURIComponent(playerId)}`;
  return source ? `${base}?from=${source}` : base;
}

export function palDefenderGuildHref(
  serverId: string,
  guildId: string,
  source?: DetailPageSource,
): string {
  const base = `/servers/${encodeURIComponent(serverId)}/guilds/${encodeURIComponent(guildId)}`;
  return source ? `${base}?from=${source}` : base;
}

export function palDefenderBaseHref(
  serverId: string,
  baseId: string,
  source?: DetailPageSource,
): string {
  const base = `/servers/${encodeURIComponent(serverId)}/bases/${encodeURIComponent(baseId)}`;
  return source ? `${base}?from=${source}` : base;
}

// Deep link into the Living World Map for one base. The URL identifies the
// base by server (path) + baseId (query) only; no coordinates travel in the
// link. Consumed once as an initial value by the map.
export function baseMapDeepLinkHref(serverId: string, baseId: string): string {
  return `/servers/${encodeURIComponent(serverId)}?tab=map&base=${encodeURIComponent(baseId)}`;
}
