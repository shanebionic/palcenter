import assert from "node:assert/strict";
import test from "node:test";
import { isServerPasswordProtected } from "../src/services/server-password-status.js";

test("treats empty and whitespace-only server passwords as not protected", () => {
  assert.equal(isServerPasswordProtected({ ServerPassword: "" }), false);
  assert.equal(isServerPasswordProtected({ ServerPassword: "   " }), false);
});

test("treats a non-empty server password as protected", () => {
  assert.equal(isServerPasswordProtected({ ServerPassword: "secret" }), true);
});

test("treats a missing or null server password as not protected", () => {
  assert.equal(isServerPasswordProtected({}), false);
  assert.equal(isServerPasswordProtected({ ServerPassword: null }), false);
});

test("does not infer join-password protection from the admin password", () => {
  const settings = {
    AdminPassword: "admin-secret",
    ServerPassword: "",
  };

  assert.equal(isServerPasswordProtected(settings), false);
});
