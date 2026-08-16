import assert from "node:assert/strict";
import test from "node:test";
import type { PalDefenderBase } from "../lib/api";
import {
  BASE_LOCATION_UNAVAILABLE_LABEL,
  BASE_LOCATION_UNAVAILABLE_ON_MAP_LABEL,
  BASE_NOT_FOUND_LABEL,
  VIEW_ON_PALPAGOS_LABEL,
  basePalpagosProjection,
  resolveLinkedBaseLocation,
} from "../lib/world-map/base-location";
import {
  palpagosMapDefinition,
  worldTreeMapDefinition,
} from "../lib/world-map/map-definitions";
import {
  palpagosProjection,
  worldToNormalizedMapPosition,
  worldTreeProjection,
} from "../lib/world-map/projection";

function makeBase(baseId: string, x: number, y: number): PalDefenderBase {
  return {
    baseId,
    guildId: "guild-1",
    guildName: "Test Guild",
    guildAdministrator: { playerId: "player-1", name: "Admin" },
    worldPosition: { x, y, z: 0 },
    mapPosition: { x: 0, y: 0, z: 0 },
  };
}

const loaded = (bases: PalDefenderBase[]) => ({ loaded: true, bases });
const notLoaded = () => ({ loaded: false, bases: [] as PalDefenderBase[] });

// Numeric overlap of the verified Palpagos and World Tree bounds:
// x in [347351.5, 349400], y in [-724400, -476400].
const OVERLAP_X = 348_000;
const OVERLAP_Y = -600_000;

test("overlap fixture actually falls inside both verified map bounds", () => {
  const inPalpagos = worldToNormalizedMapPosition(
    { x: OVERLAP_X, y: OVERLAP_Y },
    palpagosProjection,
  );
  const inTree = worldToNormalizedMapPosition(
    { x: OVERLAP_X, y: OVERLAP_Y },
    worldTreeProjection,
  );
  assert.ok(inPalpagos !== null, "fixture must be inside Palpagos bounds");
  assert.ok(
    inTree !== null,
    "fixture must be inside World Tree bounds (numeric overlap)",
  );
});

test("centers an in-bounds base when the active map is Palpagos", () => {
  const base = makeBase("base-1", -100_000, -200_000);
  const outcome = resolveLinkedBaseLocation(
    loaded([base]),
    "base-1",
    palpagosMapDefinition,
  );
  assert.equal(outcome.kind, "center");
  if (outcome.kind !== "center") return;
  assert.ok(outcome.position.x >= 0 && outcome.position.x <= 1);
  assert.ok(outcome.position.y >= 0 && outcome.position.y <= 1);
});

test("reports not-found only when the base list loaded successfully", () => {
  const outcome = resolveLinkedBaseLocation(
    loaded([makeBase("base-other", -100_000, -200_000)]),
    "base-missing",
    palpagosMapDefinition,
  );
  assert.deepEqual(outcome, { kind: "not-found" });
});

test("never reports not-found when the base layer failed to load", () => {
  const outcome = resolveLinkedBaseLocation(
    notLoaded(),
    "base-1",
    palpagosMapDefinition,
  );
  assert.deepEqual(outcome, { kind: "unavailable", actionable: false });
});

test("never reports not-found on a map that cannot display bases", () => {
  const outcome = resolveLinkedBaseLocation(
    loaded([makeBase("base-other", -100_000, -200_000)]),
    "base-missing",
    worldTreeMapDefinition,
  );
  assert.equal(outcome.kind, "unavailable");
  if (outcome.kind === "unavailable") {
    assert.equal(outcome.actionable, false);
  }
});

test("regression: overlap-region coordinates never center on the World Tree", () => {
  // These coordinates fall numerically inside BOTH verified map bounds.
  // Base DTOs carry no coordinate-space identifier, so the resolver must
  // still refuse to treat them as World Tree positions.
  const base = makeBase("base-1", OVERLAP_X, OVERLAP_Y);

  const onTree = resolveLinkedBaseLocation(
    loaded([base]),
    "base-1",
    worldTreeMapDefinition,
  );
  assert.notEqual(onTree.kind, "center");
  assert.equal(onTree.kind, "unavailable");
  // The base has a verified Palpagos position, so the switch action is
  // offered.
  if (onTree.kind === "unavailable") {
    assert.equal(onTree.actionable, true);
  }

  const onPalpagos = resolveLinkedBaseLocation(
    loaded([base]),
    "base-1",
    palpagosMapDefinition,
  );
  assert.equal(onPalpagos.kind, "center");
});

test("out-of-Palpagos-bounds base coordinates are unavailable, not actionable", () => {
  const base = makeBase("base-1", 500_000, -200_000);
  const outcome = resolveLinkedBaseLocation(
    loaded([base]),
    "base-1",
    palpagosMapDefinition,
  );
  assert.deepEqual(outcome, { kind: "unavailable", actionable: false });
});

test("non-finite base coordinates are unavailable, not actionable", () => {
  const base = makeBase("base-1", Number.NaN, -200_000);
  const outcome = resolveLinkedBaseLocation(
    loaded([base]),
    "base-1",
    palpagosMapDefinition,
  );
  assert.deepEqual(outcome, { kind: "unavailable", actionable: false });
});

test("a known in-bounds base on the World Tree map is actionable", () => {
  const base = makeBase("base-1", -100_000, -200_000);
  assert.ok(basePalpagosProjection(base) !== null);
  const outcome = resolveLinkedBaseLocation(
    loaded([base]),
    "base-1",
    worldTreeMapDefinition,
  );
  assert.deepEqual(outcome, { kind: "unavailable", actionable: true });
});

test("unavailability from a failed layer is never actionable", () => {
  for (const definition of [palpagosMapDefinition, worldTreeMapDefinition]) {
    const outcome = resolveLinkedBaseLocation(
      notLoaded(),
      "base-1",
      definition,
    );
    assert.equal(outcome.kind, "unavailable");
    if (outcome.kind === "unavailable") {
      assert.equal(outcome.actionable, false);
    }
  }
});

test("base state labels stay in plain language", () => {
  assert.equal(BASE_NOT_FOUND_LABEL, "Base not found");
  assert.equal(BASE_LOCATION_UNAVAILABLE_LABEL, "Location unavailable");
  assert.equal(
    BASE_LOCATION_UNAVAILABLE_ON_MAP_LABEL,
    "Location unavailable on this map",
  );
  assert.equal(VIEW_ON_PALPAGOS_LABEL, "View on Palpagos");
});
