export function palDefenderPlayerHref(playerId: string): string {
  return `/paldefender/players/${encodeURIComponent(playerId)}`;
}

export function palDefenderGuildHref(guildId: string): string {
  return `/paldefender/guilds/${encodeURIComponent(guildId)}`;
}

export function palDefenderBaseHref(baseId: string): string {
  return `/paldefender/bases/${encodeURIComponent(baseId)}`;
}
