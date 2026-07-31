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

function fixture() {
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
    service: new PlayerActivityEventService(repository),
  };
}

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
    assert.equal(event?.metadata.displacement, 200_000);
    assert.equal(event?.metadata.impliedSpeed, 2_500);
    assert.deepEqual(event?.position, { x: 200_000, y: 0, z: null });
    assert.deepEqual(
      event?.evidence.map(({ fact }) => fact),
      ["rapid_displacement", "implied_speed", "observation_continuous"],
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
