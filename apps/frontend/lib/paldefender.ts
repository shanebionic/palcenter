function serverQuery(serverId: string): string {
  return `?serverId=${encodeURIComponent(serverId)}`;
}

export function palDefenderPlayerHref(
  serverId: string,
  playerId: string,
): string {
  return `/paldefender/players/${encodeURIComponent(playerId)}${serverQuery(serverId)}`;
}

export function palDefenderGuildHref(
  serverId: string,
  guildId: string,
): string {
  return `/paldefender/guilds/${encodeURIComponent(guildId)}${serverQuery(serverId)}`;
}

export function palDefenderBaseHref(serverId: string, baseId: string): string {
  return `/paldefender/bases/${encodeURIComponent(baseId)}${serverQuery(serverId)}`;
}
