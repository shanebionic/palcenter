export function palDefenderPlayerHref(playerId: string): string {
  return `/paldefender/players/${encodeURIComponent(playerId)}`;
}
