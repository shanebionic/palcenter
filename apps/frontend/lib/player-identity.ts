import type { PalDefenderPlayer } from "./api";
import type { ConnectedPlayer } from "../types/servers";

export function canonicalPlayerId(value: string): string {
  const trimmed = value.trim().toLocaleLowerCase();
  const compact = trimmed.replaceAll("-", "");
  return /^[0-9a-f]{32}$/.test(compact) ? compact : trimmed;
}

export function matchPalDefenderPlayer(
  nativePlayer: ConnectedPlayer,
  palDefenderPlayers: PalDefenderPlayer[],
): PalDefenderPlayer | undefined {
  const nativeId = canonicalPlayerId(nativePlayer.playerId);
  return palDefenderPlayers.find(
    (candidate) => canonicalPlayerId(candidate.playerId) === nativeId,
  );
}
