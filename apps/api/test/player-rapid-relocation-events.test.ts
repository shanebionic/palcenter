import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { SqliteHistoryRepository } from "../src/repositories/sqlite-history-repository.js";
import { SqliteWorldEventRepository } from "../src/repositories/sqlite-world-event-repository.js";
import {
  PlayerActivityEventService,
  rapidRelocationThresholds,
} from "../src/services/player-activity-event-service.js";
import {
  SpatialTransitionRegistry,
  type SpatialTransitionSignature,
} from "../src/services/spatial-transition-registry.js";
import type { NewPlayerPositionSnapshot } from "../src/telemetry/types/player-telemetry.js";

const startedAt = Date.parse("2026-07-31T12:00:00.000Z");

function snapshot(
  elapsedSeconds: number,
  x = 0,
  userId = "user-one",
): NewPlayerPositionSnapshot {
  return {
    serverId: "srv-relocation",
    userId,
    playerId: `player-${userId}`,
    playerName: userId === "user-one" ? "Denalb" : "Lamball",
    accountName: null,
    capturedAt: new Date(startedAt + elapsedSeconds * 1_000).toISOString(),
    x,
    y: 0,
    z: null,
    level: 10,
    ping: 20,
    buildingCount: 0,
    guildId: null,
    guildName: null,
  };
}

function fixture(signatures: SpatialTransitionSignature[] = []) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "palcenter-rapid-relocation-"),
  );
  const history = new SqliteHistoryRepository(directory);
  history.initialize();
  const repository = new SqliteWorldEventRepository(directory);
  repository.initialize();
  return {
    directory,
    history,
    repository,
    service: new PlayerActivityEventService(
      repository,
      new SpatialTransitionRegistry(signatures),
    ),
  };
}

const instanceSignature: SpatialTransitionSignature = {
  id: "fixture-dungeon",
  displayName: "Fixture Dungeon",
  type: "dungeon",
  destinationCoordinateSpaceId: "instance:fixture-dungeon",
  arrivalRegion: { centerX: 300_000, centerY: 0, tolerance: 1_000 },
  originRegions: [{ centerX: 0, centerY: 0, tolerance: 5_000 }],
  exitRegions: [
    {
      centerX: 1_000,
      centerY: 0,
      tolerance: 1_000,
      destinationCoordinateSpaceId: "palpagos",
    },
    {
      centerX: 5_000,
      centerY: 0,
      tolerance: 1_000,
      destinationCoordinateSpaceId: "palpagos",
    },
  ],
  source: { name: "test fixture", version: "1" },
  enabled: true,
};

const mapSignature: SpatialTransitionSignature = {
  id: "fixture-world-tree",
  displayName: "Fixture Secondary Map",
  type: "secondary_map",
  destinationCoordinateSpaceId: "world_tree",
  arrivalRegion: { centerX: -300_000, centerY: 0, tolerance: 1_000 },
  originRegions: [{ centerX: 0, centerY: 0, tolerance: 5_000 }],
  exitRegions: [
    {
      centerX: -1_000,
      centerY: 0,
      tolerance: 1_000,
      destinationCoordinateSpaceId: "palpagos",
    },
  ],
  source: { name: "test fixture", version: "1" },
  enabled: true,
};

const palpagosFixtureSignature: SpatialTransitionSignature = {
  id: "fixture-palpagos-reference",
  displayName: "Fixture Palpagos Reference",
  type: "other",
  destinationCoordinateSpaceId: "palpagos",
  arrivalRegion: { centerX: 0, centerY: 0, tolerance: 5_000 },
  source: { name: "test fixture", version: "1" },
  enabled: true,
};

function cleanup(context: ReturnType<typeof fixture>) {
  context.repository.close();
  context.history.close();
  fs.rmSync(context.directory, { recursive: true, force: true });
}

test("ordinary movement, jitter, and either threshold alone do not emit relocation", () => {
  const context = fixture();
  try {
    context.service.process("srv-relocation", [snapshot(0)]);
    assert.deepEqual(
      context.service.process("srv-relocation", [snapshot(30, 1_000)]),
      [],
    );
    assert.deepEqual(
      context.service.process("srv-relocation", [snapshot(60, 199_999)]),
      [],
      "high implied speed below the displacement threshold stays ordinary",
    );
    assert.deepEqual(
      context.service.process("srv-relocation", [snapshot(150, 399_999)]),
      [],
      "large displacement below the speed threshold stays ordinary",
    );
  } finally {
    cleanup(context);
  }
});

test("exact conservative displacement and speed boundaries emit one neutral relocation", () => {
  const context = fixture();
  try {
    context.service.process("srv-relocation", [snapshot(0)]);
    const [event] = context.service.process("srv-relocation", [
      snapshot(80, 200_000),
    ]);
    assert.equal(event?.type, "player_rapid_relocation");
    assert.equal(event?.timestamp, snapshot(80).capturedAt);
    assert.equal(event?.confidence, 0.9);
    assert.equal(event?.metadata.classification, "unexplained_relocation");
    assert.equal(event?.metadata.originX, 0);
    assert.equal(event?.metadata.destinationX, 200_000);
    assert.equal(event?.metadata.elapsedSeconds, 80);
    assert.equal("displacement" in (event?.metadata ?? {}), false);
    assert.equal("impliedSpeed" in (event?.metadata ?? {}), false);
    assert.deepEqual(event?.position, { x: 200_000, y: 0, z: null });
    assert.deepEqual(
      event?.evidence.map(({ fact }) => fact),
      ["observation_continuous"],
    );
  } finally {
    cleanup(context);
  }
});

test("trusted elapsed-time boundaries are inclusive and reject outside samples", () => {
  const tooSoon = fixture();
  const minimum = fixture();
  const maximum = fixture();
  const tooLate = fixture();
  try {
    for (const context of [tooSoon, minimum, maximum, tooLate]) {
      context.service.process("srv-relocation", [snapshot(0)]);
    }
    assert.deepEqual(
      tooSoon.service.process("srv-relocation", [snapshot(4, 200_000)]),
      [],
    );
    assert.equal(
      minimum.service.process("srv-relocation", [snapshot(5, 200_000)])[0]
        ?.type,
      "player_rapid_relocation",
    );
    assert.equal(
      maximum.service.process("srv-relocation", [snapshot(90, 225_000)])[0]
        ?.type,
      "player_rapid_relocation",
    );
    assert.deepEqual(
      tooLate.service.process("srv-relocation", [snapshot(91, 300_000)]),
      [],
    );
  } finally {
    cleanup(tooSoon);
    cleanup(minimum);
    cleanup(maximum);
    cleanup(tooLate);
  }
});

test("disconnects, outages, excessive gaps, duplicates, and delayed samples break continuity", () => {
  const context = fixture();
  try {
    context.service.process("srv-relocation", [snapshot(0)]);
    context.service.process("srv-relocation", []);
    assert.deepEqual(
      context.service.process("srv-relocation", [snapshot(30, 300_000)]),
      [],
    );
    assert.deepEqual(
      context.service.process("srv-relocation", [snapshot(121, 600_000)]),
      [],
      "a sample after the trusted window starts a new observation baseline",
    );
    assert.deepEqual(
      context.service.process("srv-relocation", [snapshot(121, 900_000)]),
      [],
    );
    assert.deepEqual(
      context.service.process("srv-relocation", [snapshot(120, 900_000)]),
      [],
    );
  } finally {
    cleanup(context);
  }
});

test("a changed Palworld player ID establishes a new session baseline", () => {
  const context = fixture();
  try {
    context.service.process("srv-relocation", [snapshot(0)]);
    assert.deepEqual(
      context.service.process("srv-relocation", [
        { ...snapshot(30, 300_000), playerId: "replacement-player-id" },
      ]),
      [],
    );
  } finally {
    cleanup(context);
  }
});

test("restart checkpoints detect only a trustworthy next observation", () => {
  const context = fixture();
  try {
    context.service.process("srv-relocation", [snapshot(0)]);
    const restarted = new PlayerActivityEventService(context.repository);
    assert.equal(
      restarted.process("srv-relocation", [snapshot(30, 300_000)])[0]?.type,
      "player_rapid_relocation",
    );
    const staleRestart = new PlayerActivityEventService(context.repository);
    assert.deepEqual(
      staleRestart.process("srv-relocation", [snapshot(300, 600_000)]),
      [],
    );
  } finally {
    cleanup(context);
  }
});

test("one discontinuity produces one event while separate relocations remain separate", () => {
  const context = fixture();
  try {
    context.service.process("srv-relocation", [snapshot(0)]);
    const first = context.service.process("srv-relocation", [
      snapshot(30, 300_000),
    ]);
    assert.equal(first.length, 1);
    assert.deepEqual(
      context.service.process("srv-relocation", [snapshot(30, 300_000)]),
      [],
    );
    assert.deepEqual(
      context.service
        .process("srv-relocation", [snapshot(60, 300_100)])
        .map(({ type }) => type),
      [],
    );
    const second = context.service.process("srv-relocation", [
      snapshot(90, 600_100),
    ]);
    assert.equal(second.length, 1);
    assert.notEqual(first[0]?.id, second[0]?.id);
  } finally {
    cleanup(context);
  }
});

test("multiple players are tracked independently", () => {
  const context = fixture();
  try {
    context.service.process("srv-relocation", [
      snapshot(0),
      snapshot(0, 1_000, "user-two"),
    ]);
    const events = context.service.process("srv-relocation", [
      snapshot(30, 300_000),
      snapshot(30, 1_100, "user-two"),
    ]);
    assert.deepEqual(
      events.map(({ userId }) => userId),
      ["user-one"],
    );
  } finally {
    cleanup(context);
  }
});

test("Idle and AFK resume before relocation at the same proving sample", () => {
  const context = fixture();
  try {
    for (const seconds of [0, 300, 600]) {
      context.service.process("srv-relocation", [snapshot(seconds)]);
    }
    assert.deepEqual(
      context.service
        .process("srv-relocation", [snapshot(630, 300_000)])
        .map(({ type }) => type),
      ["player_idle_ended", "player_rapid_relocation"],
    );
    assert.deepEqual(
      context.repository
        .list("srv-relocation", { limit: 20 })
        .filter(({ timestamp }) => timestamp === snapshot(630).capturedAt)
        .map(({ type }) => type),
      ["player_idle_ended", "player_rapid_relocation"],
    );

    context.service.process("srv-relocation", []);
    for (const seconds of [900, 1_200, 1_500, 1_800, 2_100, 2_400, 2_700]) {
      context.service.process("srv-relocation", [snapshot(seconds, 500_000)]);
    }
    assert.deepEqual(
      context.service
        .process("srv-relocation", [snapshot(2_730, 800_000)])
        .map(({ type }) => type),
      ["player_afk_ended", "player_rapid_relocation"],
    );
  } finally {
    cleanup(context);
  }
});

test("identical inputs reproduce stable relocation IDs and timestamps", () => {
  const first = fixture();
  const second = fixture();
  try {
    for (const context of [first, second]) {
      context.service.process("srv-relocation", [snapshot(0)]);
    }
    const firstEvent = first.service.process("srv-relocation", [
      snapshot(30, 300_000),
    ])[0];
    const secondEvent = second.service.process("srv-relocation", [
      snapshot(30, 300_000),
    ])[0];
    assert.equal(firstEvent?.id, secondEvent?.id);
    assert.equal(firstEvent?.timestamp, secondEvent?.timestamp);
    assert.equal(rapidRelocationThresholds.maximumObservationGapMs, 90_000);
  } finally {
    cleanup(first);
    cleanup(second);
  }
});

test("empty registry preserves neutral unknown-space relocation behavior", () => {
  const context = fixture();
  try {
    context.service.process("srv-relocation", [snapshot(0)]);
    const [event] = context.service.process("srv-relocation", [
      snapshot(30, 300_000),
    ]);
    assert.equal(event?.metadata.classification, "unexplained_relocation");
    assert.equal(event?.metadata.originCoordinateSpaceId, "unknown");
    assert.equal(event?.metadata.destinationCoordinateSpaceId, "unknown");
    assert.equal("displacement" in (event?.metadata ?? {}), false);
    assert.equal("impliedSpeed" in (event?.metadata ?? {}), false);
  } finally {
    cleanup(context);
  }
});

test("known same-space movement uses ordinary travel analysis", () => {
  const context = fixture([palpagosFixtureSignature]);
  try {
    context.service.process("srv-relocation", [snapshot(0)]);
    assert.deepEqual(
      context.service.process("srv-relocation", [snapshot(30, 1_000)]),
      [],
    );
    const [event] = context.service.process("srv-relocation", [
      snapshot(60, 301_000),
    ]);
    assert.equal(event?.metadata.classification, "unexplained_relocation");
    assert.equal(event?.metadata.originCoordinateSpaceId, "palpagos");
    assert.equal(event?.metadata.destinationCoordinateSpaceId, "palpagos");
    assert.equal(event?.metadata.displacement, 300_000);
    assert.equal(event?.metadata.impliedSpeed, 10_000);
  } finally {
    cleanup(context);
  }
});

test("verified instance entry and exits change spaces without cross-space travel math", () => {
  const context = fixture([instanceSignature]);
  try {
    context.service.process("srv-relocation", [snapshot(0)]);
    const [entry] = context.service.process("srv-relocation", [
      snapshot(30, 300_000),
    ]);
    assert.equal(entry?.metadata.classification, "likely_instance_transition");
    assert.equal(entry?.metadata.transitionDirection, "entry");
    assert.equal(
      entry?.metadata.matchedTransitionSignatureId,
      "fixture-dungeon",
    );
    assert.equal(
      entry?.metadata.matchedTransitionDisplayName,
      "Fixture Dungeon",
    );
    assert.equal(entry?.metadata.originCoordinateSpaceId, "unknown");
    assert.equal(
      entry?.metadata.destinationCoordinateSpaceId,
      "instance:fixture-dungeon",
    );
    assert.equal("displacement" in (entry?.metadata ?? {}), false);
    assert.equal("impliedSpeed" in (entry?.metadata ?? {}), false);

    const [exit] = context.service.process("srv-relocation", [
      snapshot(60, 1_000),
    ]);
    assert.equal(exit?.metadata.transitionDirection, "exit");
    assert.equal(exit?.metadata.destinationCoordinateSpaceId, "palpagos");

    context.service.process("srv-relocation", [snapshot(90, 0)]);
    context.service.process("srv-relocation", [snapshot(120, 300_000)]);
    const [alternateExit] = context.service.process("srv-relocation", [
      snapshot(150, 5_000),
    ]);
    assert.equal(alternateExit?.metadata.transitionDirection, "exit");
    assert.equal(alternateExit?.metadata.destinationX, 5_000);
  } finally {
    cleanup(context);
  }
});

test("verified secondary-map signature produces a map transition", () => {
  const context = fixture([mapSignature]);
  try {
    context.service.process("srv-relocation", [snapshot(0)]);
    const [event] = context.service.process("srv-relocation", [
      snapshot(30, -300_000),
    ]);
    assert.equal(event?.metadata.classification, "likely_map_transition");
    assert.equal(event?.metadata.destinationCoordinateSpaceId, "world_tree");
    assert.equal("displacement" in (event?.metadata ?? {}), false);
  } finally {
    cleanup(context);
  }
});

test("unmatched destinations retain neutral fallback with a populated registry", () => {
  const context = fixture([instanceSignature, mapSignature]);
  try {
    context.service.process("srv-relocation", [snapshot(0)]);
    const [event] = context.service.process("srv-relocation", [
      snapshot(30, 500_000),
    ]);
    assert.equal(event?.metadata.classification, "unexplained_relocation");
    assert.equal(
      "matchedTransitionSignatureId" in (event?.metadata ?? {}),
      false,
    );
  } finally {
    cleanup(context);
  }
});

test("signature tolerance is inclusive and overlapping matches are deterministic", () => {
  const broad: SpatialTransitionSignature = {
    ...instanceSignature,
    id: "a-broad",
    displayName: "Broad Fixture",
    arrivalRegion: { centerX: 300_000, centerY: 0, tolerance: 2_000 },
  };
  const narrow: SpatialTransitionSignature = {
    ...instanceSignature,
    id: "z-narrow",
    displayName: "Narrow Fixture",
    arrivalRegion: { centerX: 300_000, centerY: 0, tolerance: 1_000 },
  };
  const boundary = fixture([narrow]);
  const overlap = fixture([broad, narrow]);
  try {
    boundary.service.process("srv-relocation", [snapshot(0)]);
    const [boundaryEvent] = boundary.service.process("srv-relocation", [
      snapshot(30, 301_000),
    ]);
    assert.equal(
      boundaryEvent?.metadata.matchedTransitionSignatureId,
      "z-narrow",
    );

    overlap.service.process("srv-relocation", [snapshot(0)]);
    const [overlapEvent] = overlap.service.process("srv-relocation", [
      snapshot(30, 300_500),
    ]);
    assert.equal(
      overlapEvent?.metadata.matchedTransitionSignatureId,
      "z-narrow",
    );
  } finally {
    cleanup(boundary);
    cleanup(overlap);
  }
});

test("coordinate-space checkpoints survive restart and stale samples reset safely", () => {
  const context = fixture([instanceSignature]);
  try {
    context.service.process("srv-relocation", [snapshot(0)]);
    context.service.process("srv-relocation", [snapshot(30, 300_000)]);
    assert.equal(
      context.repository.activityStates("srv-relocation")[0]?.coordinateSpaceId,
      "instance:fixture-dungeon",
    );

    const restarted = new PlayerActivityEventService(
      context.repository,
      new SpatialTransitionRegistry([instanceSignature]),
    );
    assert.equal(
      restarted.process("srv-relocation", [snapshot(60, 1_000)])[0]?.metadata
        .transitionDirection,
      "exit",
    );
    assert.deepEqual(
      restarted.process("srv-relocation", [snapshot(300, 300_000)]),
      [],
    );
  } finally {
    cleanup(context);
  }
});

test("Idle and AFK transitions resume before cross-space events", () => {
  const idle = fixture([instanceSignature]);
  const afk = fixture([mapSignature]);
  try {
    for (const seconds of [0, 300, 600]) {
      idle.service.process("srv-relocation", [snapshot(seconds)]);
    }
    const idleEvents = idle.service.process("srv-relocation", [
      snapshot(630, 300_000),
    ]);
    assert.deepEqual(
      idleEvents.map(({ type }) => type),
      ["player_idle_ended", "player_rapid_relocation"],
    );
    assert.equal("displacement" in (idleEvents[0]?.metadata ?? {}), false);

    for (const seconds of [0, 300, 600, 900, 1_200, 1_500, 1_800]) {
      afk.service.process("srv-relocation", [snapshot(seconds)]);
    }
    const afkEvents = afk.service.process("srv-relocation", [
      snapshot(1_830, -300_000),
    ]);
    assert.deepEqual(
      afkEvents.map(({ type }) => type),
      ["player_afk_ended", "player_rapid_relocation"],
    );
    assert.equal(
      afkEvents[1]?.metadata.classification,
      "likely_map_transition",
    );
  } finally {
    cleanup(idle);
    cleanup(afk);
  }
});
