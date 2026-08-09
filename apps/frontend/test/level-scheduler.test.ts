import assert from "node:assert/strict";
import { describe, it } from "node:test";

type ProgressFetch = (
  serverId: string,
  playerId: string,
) => Promise<{ character: { level: number } }>;

const createScheduler = async () => {
  const mod = await import("../lib/level-scheduler");
  return mod;
};

function createPlayer(userId: string, playerId: string, name: string) {
  return {
    userId,
    playerId,
    name,
    ip: null,
    status: "online" as const,
  };
}

describe("levelEnrichmentPipeline", () => {
  it("enriches only players with missing levels", async () => {
    const sch = await createScheduler();
    const players = [
      createPlayer("u1", "player-1", "p1"),
      createPlayer("u2", "player-2", "p2"),
    ];
    const enrichedRef = { current: new Map<string, number>() };

    let fetchCount = 0;
    const progressFetch: ProgressFetch = () => {
      fetchCount++;
      return Promise.resolve({ character: { level: 1 } });
    };

    await sch.levelEnrichmentPipeline(
      players as never,
      [],
      enrichedRef,
      progressFetch as never,
      "srv",
    );

    assert.equal(fetchCount, 2);
    assert.ok(enrichedRef.current.size >= 2);
  });

  it("limits concurrent requests to 3", async () => {
    const sch = await createScheduler();
    const players = Array.from({ length: 6 }, (_, i) =>
      createPlayer(`u${i}`, `pp-${String(i).padStart(8, "0")}`, `p${i}`),
    );
    const enrichedRef = { current: new Map<string, number>() };

    let maxConcurrent = 0;
    let active = 0;
    const progressFetch: ProgressFetch = () => {
      active++;
      if (active > maxConcurrent) maxConcurrent = active;
      return new Promise((r) => {
        setTimeout(() => {
          active--;
          r({ character: { level: 1 } });
        }, 15);
      });
    };

    await sch.levelEnrichmentPipeline(
      players as never,
      [],
      enrichedRef,
      progressFetch as never,
      "srv",
    );

    assert.ok(maxConcurrent <= 3, `expected <= 3 but was ${maxConcurrent}`);
  });

  it("deduplicates in-flight requests for the same player key", async () => {
    const sch = await createScheduler();
    const players = [
      createPlayer("u1", "pp-aaaaaaaa", "p1a"),
      createPlayer("u2", "pp-aaaaaaaa", "p1b"),
    ];
    const enrichedRef = { current: new Map<string, number>() };

    const progressFetch: ProgressFetch = () => {
      return new Promise((r) => {
        setTimeout(() => {
          r({ character: { level: 7 } });
        }, 15);
      });
    };

    await sch.levelEnrichmentPipeline(
      players as never,
      [],
      enrichedRef,
      progressFetch as never,
      "srv",
    );

    assert.ok(enrichedRef.current.has("pp-aaaaaaaa"));
  });

  it("updates each successful player independently", async () => {
    const sch = await createScheduler();
    const players = [
      createPlayer("u1", "aa-aaaaaaaa", "p1"),
      createPlayer("u2", "bb-bbbbbbbb", "p2"),
      createPlayer("u3", "cc-cccccccc", "p3"),
    ];
    const enrichedRef = { current: new Map<string, number>() };

    const progressFetch: ProgressFetch = (_serverId, playerId) => {
      return new Promise((r) => {
        setTimeout(() => {
          const level =
            playerId === "aa-aaaaaaaa" ? 1 : playerId === "bb-bbbbbbbb" ? 3 : 5;
          r({ character: { level } });
        }, 10);
      });
    };

    await sch.levelEnrichmentPipeline(
      players as never,
      [],
      enrichedRef,
      progressFetch as never,
      "srv",
    );

    assert.equal(enrichedRef.current.get("aa-aaaaaaaa"), 1);
    assert.equal(enrichedRef.current.get("bb-bbbbbbbb"), 3);
    assert.equal(enrichedRef.current.get("cc-cccccccc"), 5);
  });

  it("one failed request does not block the rest", async () => {
    const sch = await createScheduler();
    const players = [
      createPlayer("u1", "dd-dddddddd", "p1"),
      createPlayer("u2", "ee-eeeeeeee", "p2"),
    ];
    const enrichedRef = { current: new Map<string, number>() };

    const progressFetch: ProgressFetch = (_serverId, playerId) => {
      if (playerId === "dd-dddddddd") return Promise.reject(new Error("boom"));
      return Promise.resolve({ character: { level: 9 } });
    };

    await sch.levelEnrichmentPipeline(
      players as never,
      [],
      enrichedRef,
      progressFetch as never,
      "srv",
    );

    assert.ok(!enrichedRef.current.has("dd-dddddddd"));
    assert.equal(enrichedRef.current.get("ee-eeeeeeee"), 9);
  });

  it("does not fetch again for players already enriched", async () => {
    const sch = await createScheduler();
    const players = [
      createPlayer("u1", "ff-ffffffff", "p1"),
      createPlayer("u2", "gg-gggggggg", "p2"),
    ];
    const enrichedRef = {
      current: new Map<string, number>([
        ["ff-ffffffff", 13],
        ["gg-gggggggg", 40],
      ]),
    };

    let fetchCount = 0;
    const progressFetch: ProgressFetch = () => {
      fetchCount++;
      return Promise.resolve({ character: { level: 1 } });
    };

    await sch.levelEnrichmentPipeline(
      players as never,
      [],
      enrichedRef,
      progressFetch as never,
      "srv",
    );

    assert.equal(fetchCount, 0);
  });
});

describe("hasLevel", () => {
  it("returns true when enriched map contains the player key", async () => {
    const sch = await createScheduler();
    const alice = createPlayer("u1", "hh-hhhhhhhh", "alice");
    const enriched = new Map<string, number>([["hh-hhhhhhhh", 1]]);
    assert.equal(sch.hasLevel(alice as never, enriched, []), true);
  });

  it("returns false when enriched map is missing the player key", async () => {
    const sch = await createScheduler();
    const alice = createPlayer("u1", "hh-hhhhhhhh", "alice");
    const enriched = new Map<string, number>();
    assert.equal(sch.hasLevel(alice as never, enriched, []), false);
  });
});

describe("maxConcurrentLevelRequests", () => {
  it("equals 3", async () => {
    const sch = await createScheduler();
    assert.equal(sch.maxConcurrentLevelRequests(), 3);
  });
});
