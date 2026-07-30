import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { SqliteHistoryRepository } from "../src/repositories/sqlite-history-repository.js";
import { SqliteWorldEventRepository } from "../src/repositories/sqlite-world-event-repository.js";
import {
  PlayerActivityEventService,
  playerActivityThresholds,
} from "../src/services/player-activity-event-service.js";
import type { NewPlayerPositionSnapshot } from "../src/telemetry/types/player-telemetry.js";

function snapshot(
  minutes: number,
  x = 1_000,
  userId = "user-one",
): NewPlayerPositionSnapshot {
  return {
    serverId: "srv-activity",
    userId,
    playerId: `player-${userId}`,
    playerName: userId === "user-one" ? "Denalb" : "Lamball",
    accountName: null,
    capturedAt: new Date(
      Date.parse("2026-07-30T12:00:00.000Z") + minutes * 60_000,
    ).toISOString(),
    x,
    y: 2_000,
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
    path.join(os.tmpdir(), "palcenter-activity-events-"),
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

function observeThrough(
  service: PlayerActivityEventService,
  endMinutes: number,
  x = 1_000,
) {
  const events = [];
  for (let minute = 0; minute <= endMinutes; minute += 5) {
    events.push(...service.process("srv-activity", [snapshot(minute, x)]));
  }
  return events;
}

test("ACTIVE to IDLE to AFK to ACTIVE emits one deterministic transition each", () => {
  const context = fixture();
  try {
    const inactivity = observeThrough(context.service, 30);
    assert.deepEqual(
      inactivity.map(({ type }) => type),
      ["player_idle_started", "player_afk_started"],
    );
    assert.deepEqual(
      inactivity.map(({ timestamp }) => timestamp),
      [snapshot(10).capturedAt, snapshot(30).capturedAt],
    );
    assert.ok(inactivity.every(({ confidence }) => confidence === 0.9));
    assert.equal(inactivity[0]?.metadata.movementRadius, 300);
    assert.equal(inactivity[1]?.metadata.inactivityMinutes, 30);

    const resumed = context.service.process("srv-activity", [
      snapshot(31, 1_301),
    ]);
    assert.deepEqual(
      resumed.map(({ type }) => type),
      ["player_afk_ended"],
    );
    assert.equal(resumed[0]?.timestamp, snapshot(31).capturedAt);
    assert.equal(resumed[0]?.metadata.priorActivityState, "afk");
    assert.equal(resumed[0]?.position?.x, 1_301);

    const duplicate = context.service.process("srv-activity", [
      snapshot(31, 1_301),
    ]);
    assert.deepEqual(duplicate, []);
  } finally {
    context.repository.close();
    context.history.close();
    fs.rmSync(context.directory, { recursive: true, force: true });
  }
});

test("IDLE returns directly to ACTIVE when movement exceeds the radius", () => {
  const context = fixture();
  try {
    observeThrough(context.service, 10);
    assert.deepEqual(
      context.service
        .process("srv-activity", [snapshot(11, 1_301)])
        .map(({ type }) => type),
      ["player_idle_ended"],
    );
  } finally {
    context.repository.close();
    context.history.close();
    fs.rmSync(context.directory, { recursive: true, force: true });
  }
});

test("jitter and movement at the radius remain inactive while movement beyond it resumes", () => {
  const context = fixture();
  try {
    context.service.process("srv-activity", [snapshot(0)]);
    for (const [minute, x] of [
      [5, 1_050],
      [10, 950],
      [15, 1_300],
    ]) {
      context.service.process("srv-activity", [snapshot(minute, x)]);
    }
    assert.equal(
      context.repository.activityStates("srv-activity")[0]?.state,
      "idle",
    );
    assert.deepEqual(
      context.service
        .process("srv-activity", [snapshot(16, 1_301)])
        .map(({ type }) => type),
      ["player_idle_ended"],
    );
  } finally {
    context.repository.close();
    context.history.close();
    fs.rmSync(context.directory, { recursive: true, force: true });
  }
});

test("disconnect while IDLE or AFK closes state without a resumed event and reconnects clean", () => {
  const context = fixture();
  try {
    observeThrough(context.service, 10);
    assert.deepEqual(context.service.process("srv-activity", []), []);
    assert.deepEqual(context.repository.activityStates("srv-activity"), []);
    assert.deepEqual(
      context.service.process("srv-activity", [snapshot(11, 5_000)]),
      [],
    );
    for (const minute of [16, 21, 26, 31, 36, 41]) {
      context.service.process("srv-activity", [snapshot(minute, 5_000)]);
    }
    assert.equal(
      context.repository.activityStates("srv-activity")[0]?.state,
      "afk",
    );
    assert.deepEqual(context.service.process("srv-activity", []), []);
    assert.deepEqual(context.repository.activityStates("srv-activity"), []);
  } finally {
    context.repository.close();
    context.history.close();
    fs.rmSync(context.directory, { recursive: true, force: true });
  }
});

test("telemetry outages, delayed samples, duplicates, and out-of-order samples do not create inactivity", () => {
  const context = fixture();
  try {
    assert.deepEqual(
      context.service.process("srv-activity", [snapshot(0)]),
      [],
    );
    assert.deepEqual(
      context.service.process("srv-activity", [snapshot(10)]),
      [],
      "a gap beyond the observation boundary resets inference",
    );
    assert.deepEqual(
      context.service.process("srv-activity", [snapshot(10)]),
      [],
    );
    assert.deepEqual(
      context.service.process("srv-activity", [snapshot(5)]),
      [],
    );
    assert.equal(
      context.repository.activityStates("srv-activity")[0]?.anchorAt,
      snapshot(10).capturedAt,
    );
  } finally {
    context.repository.close();
    context.history.close();
    fs.rmSync(context.directory, { recursive: true, force: true });
  }
});

test("persisted checkpoints survive restart and track multiple players independently", () => {
  const context = fixture();
  try {
    context.service.process("srv-activity", [
      snapshot(0),
      snapshot(0, 5_000, "user-two"),
    ]);
    context.service.process("srv-activity", [
      snapshot(5),
      snapshot(5, 5_400, "user-two"),
    ]);
    const restarted = new PlayerActivityEventService(context.repository);
    const events = restarted.process("srv-activity", [
      snapshot(10),
      snapshot(10, 5_800, "user-two"),
    ]);
    assert.deepEqual(
      events.map(({ userId }) => userId),
      ["user-one"],
    );
    const repeated = restarted.process("srv-activity", [
      snapshot(10),
      snapshot(10, 5_800, "user-two"),
    ]);
    assert.deepEqual(repeated, []);
    assert.equal(
      restarted.process("srv-activity", [snapshot(15)])[0]?.id,
      undefined,
    );
    assert.equal(playerActivityThresholds.idleDurationMs, 600_000);
  } finally {
    context.repository.close();
    context.history.close();
    fs.rmSync(context.directory, { recursive: true, force: true });
  }
});

test("identical observations produce identical event IDs and timestamps", () => {
  const first = fixture();
  const second = fixture();
  try {
    const firstEvent = observeThrough(first.service, 10)[0];
    const secondEvent = observeThrough(second.service, 10)[0];
    assert.equal(firstEvent?.id, secondEvent?.id);
    assert.equal(firstEvent?.timestamp, secondEvent?.timestamp);
    assert.match(firstEvent?.id ?? "", /^wie_[a-f0-9]{24}$/);
  } finally {
    first.repository.close();
    first.history.close();
    second.repository.close();
    second.history.close();
    fs.rmSync(first.directory, { recursive: true, force: true });
    fs.rmSync(second.directory, { recursive: true, force: true });
  }
});
