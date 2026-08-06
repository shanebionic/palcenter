import assert from "node:assert/strict";
import test from "node:test";
import { palDefenderPlayerHref } from "../lib/paldefender";

test("builds an encoded PalDefender player workspace route", () => {
  assert.equal(
    palDefenderPlayerHref("player id/unsafe"),
    "/paldefender/players/player%20id%2Funsafe",
  );
});
