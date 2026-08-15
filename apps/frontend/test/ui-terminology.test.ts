import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("world map player copy uses plain-language terminology", async () => {
  const source = await readFile(
    new URL("../components/ServerWorldMap.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /Outside verified map bounds/);
  assert.doesNotMatch(source, /trusted Palpagos/i);
  assert.match(source, /"Outside this map"/);
  assert.match(source, /Last known Palpagos position updated/);
  assert.match(source, /No known Palpagos position is available\./);
  assert.match(source, /last known Palpagos location/);
  assert.match(source, /Last known Palpagos coordinates/);
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

test("preserved diagnostic and REST terminology stays intact", async () => {
  const worldMap = await readFile(
    new URL("../components/ServerWorldMap.tsx", import.meta.url),
    "utf8",
  );
  assert.match(worldMap, /Space: \$\{player\.coordinateSpaceId\}/);
  const connection = await readFile(
    new URL("../components/ServerConnectionSettings.tsx", import.meta.url),
    "utf8",
  );
  assert.match(connection, /REST URL/);
});
