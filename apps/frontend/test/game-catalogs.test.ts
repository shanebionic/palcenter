import assert from "node:assert/strict";
import { test } from "node:test";
import {
  eggCatalog,
  itemCatalog,
  palCatalog,
  searchCatalog,
  technologyCatalog,
} from "../lib/game-catalogs";

test("friendly, partial, case-insensitive, and internal item searches resolve IDs", () => {
  assert.equal(
    searchCatalog(itemCatalog, "ultimate sphere")[0]?.id,
    "PalSphere_Ultimate",
  );
  assert.equal(
    searchCatalog(itemCatalog, "ULTIMATE")[0]?.id,
    "PalSphere_Ultimate",
  );
  assert.equal(
    searchCatalog(itemCatalog, "PalSphere_Ultimate")[0]?.name,
    "Ultimate Sphere",
  );
});

test("schematic display tiers and rarity are derived searchable fields", () => {
  const result = searchCatalog(itemCatalog, "advanced bow +4 legendary");
  assert.equal(result[0]?.id, "Blueprint_SFBow_5");
  assert.equal(result[0]?.displayName, "Advanced Bow Schematic +4");
});

test("the dedicated egg catalog excludes ordinary items", () => {
  assert.equal(
    searchCatalog(eggCatalog, "common egg")[0]?.id,
    "PalEgg_Normal_01",
  );
  assert.equal(searchCatalog(eggCatalog, "ultimate sphere").length, 0);
  assert.equal(eggCatalog.length, 53);
});

test("friendly Pal and technology names resolve provider internal IDs", () => {
  assert.equal(searchCatalog(palCatalog, "lamball")[0]?.id, "SheepBall");
  assert.equal(
    searchCatalog(technologyCatalog, "primitive workbench")[0]?.id,
    "Workbench",
  );
});
