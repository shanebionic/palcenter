export function palDefenderPlayerHref(playerId: string): string {
  return `/paldefender/players/${encodeURIComponent(playerId)}`;
}

export function palDefenderGuildHref(guildId: string): string {
  return `/paldefender/guilds/${encodeURIComponent(guildId)}`;
}
