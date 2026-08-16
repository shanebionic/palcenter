import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("world map sidebar presents locations in plain language", async () => {
  const source = await readFile(
    new URL("../components/ServerWorldMap.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /Outside verified map bounds/);
  assert.doesNotMatch(source, /trusted Palpagos/i);
  assert.doesNotMatch(source, /Off-map or locating/);
  assert.doesNotMatch(source, /Off-map players/);
  assert.doesNotMatch(source, /Advanced location details/);
  assert.doesNotMatch(source, /Space: \$\{player\.coordinateSpaceId\}/);
  assert.doesNotMatch(source, /Last known Palpagos position updated/);
  assert.doesNotMatch(source, /No known Palpagos position is available\./);
  assert.match(source, /Players on other maps/);
  assert.match(source, /Location unavailable/);
  assert.match(source, /last known Palpagos location/);
  assert.match(source, /Last known Palpagos coordinates/);
});

test("world map cross-map copy uses explicit navigation labels", async () => {
  const model = await readFile(
    new URL("../lib/world-map/model.ts", import.meta.url),
    "utf8",
  );
  for (const copy of [
    "On Palpagos",
    "In World Tree",
    "View on Palpagos",
    "View on World Tree",
    "Location unavailable",
  ]) {
    assert.ok(model.includes(copy), `expected model.ts to contain ${copy}`);
  }
});

test("paldefender technology toast reports the concrete result", async () => {
  const source = await readFile(
    new URL("../components/PalDefenderPlayerWorkspace.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /authoritative state/i);
  assert.match(
    source,
    /message: `\$\{result\.changedCount\} technolog\$\{result\.changedCount === 1 \? "y" : "ies"\} changed\.`/,
  );
});

test("base deep link states use plain language", async () => {
  const labels = await readFile(
    new URL("../lib/world-map/base-location.ts", import.meta.url),
    "utf8",
  );
  for (const copy of [
    "Base not found",
    "Location unavailable",
    "Location unavailable on this map",
    "View on Palpagos",
  ]) {
    assert.ok(
      labels.includes(`"${copy}"`),
      `expected base-location.ts to define ${copy}`,
    );
  }

  const baseWorkspace = await readFile(
    new URL("../components/ServerBaseWorkspace.tsx", import.meta.url),
    "utf8",
  );
  assert.ok(baseWorkspace.includes("View on map"));

  const map = await readFile(
    new URL("../components/ServerWorldMap.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(map, /Base not found: /);
  assert.doesNotMatch(map, /Could not center/i);
});

test("preserved REST terminology stays intact", async () => {
  const connection = await readFile(
    new URL("../components/ServerConnectionSettings.tsx", import.meta.url),
    "utf8",
  );
  assert.match(connection, /REST URL/);
});
