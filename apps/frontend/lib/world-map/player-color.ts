const playerColors = [
  "#22d3ee",
  "#60a5fa",
  "#818cf8",
  "#a78bfa",
  "#e879f9",
  "#f472b6",
  "#fb7185",
  "#fb923c",
  "#facc15",
  "#a3e635",
  "#4ade80",
  "#2dd4bf",
] as const;

export function playerColor(userId: string): string {
  let hash = 2_166_136_261;
  for (const character of userId || "unknown-player") {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16_777_619);
  }
  return playerColors[(hash >>> 0) % playerColors.length] ?? playerColors[0];
}

export function isPlayerColor(value: string): boolean {
  return (playerColors as readonly string[]).includes(value);
}
