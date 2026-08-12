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
