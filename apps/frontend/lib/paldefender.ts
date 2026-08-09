export function palDefenderPlayerHref(
  serverId: string,
  playerId: string,
): string {
  return `/servers/${encodeURIComponent(serverId)}/players/${encodeURIComponent(playerId)}`;
}

export function palDefenderGuildHref(
  serverId: string,
  guildId: string,
): string {
  return `/servers/${encodeURIComponent(serverId)}/guilds/${encodeURIComponent(guildId)}`;
}

export function palDefenderBaseHref(serverId: string, baseId: string): string {
  return `/servers/${encodeURIComponent(serverId)}/bases/${encodeURIComponent(baseId)}`;
}
