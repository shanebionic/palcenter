import assert from "node:assert/strict";
import test from "node:test";
import { passwordProtectionPresentation } from "../lib/server-password-status";

test("does not show a lock and labels an unprotected server consistently", () => {
  assert.deepEqual(passwordProtectionPresentation(false), {
    label: "Not protected",
    showLock: false,
  });
});

test("shows a lock and labels a protected server consistently", () => {
  assert.deepEqual(passwordProtectionPresentation(true), {
    label: "Protected",
    showLock: true,
  });
});

test("does not show a lock when password protection is unknown", () => {
  assert.deepEqual(passwordProtectionPresentation(null), {
    label: "Unknown",
    showLock: false,
  });
});
