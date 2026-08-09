import type { ConnectedPlayer } from "../types/servers";
import type { PalDefenderProgression, PalDefenderPlayer } from "./api";
import { canonicalPlayerId, matchPalDefenderPlayer } from "./player-identity";

const MAX_CONCURRENT = 3;

export const maxConcurrentLevelRequests = () => MAX_CONCURRENT;

function getPlayerKey(
  player: ConnectedPlayer,
  palDefenderPlayers: PalDefenderPlayer[],
): string {
  const enhanced = matchPalDefenderPlayer(player, palDefenderPlayers);
  return canonicalPlayerId(enhanced?.playerId ?? player.playerId);
}

export async function levelEnrichmentPipeline(
  players: ConnectedPlayer[],
  palDefenderPlayers: PalDefenderPlayer[],
  enrichedRef: { current: Map<string, number> },
  progressFetch: (
    serverId: string,
    playerId: string,
  ) => Promise<PalDefenderProgression>,
  serverId: string,
): Promise<void> {
  const inFlight = new Map<string, Promise<void>>();

  const queued = players.filter(
    (p) => !hasLevel(p, enrichedRef.current, palDefenderPlayers),
  );

  if (queued.length === 0) return;

  let idx = 0;
  while (idx < queued.length) {
    const batch: Promise<void>[] = [];
    for (let i = 0; i < MAX_CONCURRENT && idx < queued.length; i++, idx++) {
      const player = queued[idx]!;
      const key = getPlayerKey(player, palDefenderPlayers);

      if (enrichedRef.current.has(key)) continue;

      if (inFlight.has(key)) {
        batch.push(inFlight.get(key)!);
        continue;
      }

      const promise = enrichPlayer(
        player,
        key,
        progressFetch,
        serverId,
        enrichedRef,
        inFlight,
      );
      inFlight.set(key, promise);
      batch.push(promise);
    }
    await Promise.allSettled(batch);
  }

  for (const [, p] of inFlight) {
    await p;
  }
}

async function enrichPlayer(
  player: ConnectedPlayer,
  key: string,
  progressFetch: (
    serverId: string,
    playerId: string,
  ) => Promise<PalDefenderProgression>,
  serverId: string,
  enrichedRef: { current: Map<string, number> },
  inFlight: Map<string, Promise<void>>,
): Promise<void> {
  try {
    const prog = await progressFetch(serverId, player.playerId);
    enrichedRef.current.set(key, prog.character.level);
  } catch {
    /* individual failures are absorbed */
  } finally {
    inFlight.delete(key);
  }
}

export function hasLevel(
  player: ConnectedPlayer,
  enriched: Map<string, number>,
  palDefenderPlayers: PalDefenderPlayer[],
): boolean {
  const enhanced = matchPalDefenderPlayer(player, palDefenderPlayers);
  if (enhanced?.level != null) return true;
  const key = canonicalPlayerId(enhanced?.playerId ?? player.playerId);
  return enriched.has(key);
}
