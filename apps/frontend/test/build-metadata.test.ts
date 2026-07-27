import assert from "node:assert/strict";
import test from "node:test";
import { buildChannelPresentation } from "../lib/build-metadata";

test("presents production builds with the blue production badge", () => {
  assert.deepEqual(buildChannelPresentation("production"), {
    label: "Production Build",
    color: "blue",
    showCommit: false,
  });
});

test("presents development builds with the orange development badge", () => {
  assert.deepEqual(buildChannelPresentation("development"), {
    label: "Development Build",
    color: "orange",
    showCommit: true,
  });
});
