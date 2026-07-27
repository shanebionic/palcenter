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

test("treats a missing or null server password as unknown", () => {
  assert.equal(isServerPasswordProtected({}), null);
  assert.equal(isServerPasswordProtected({ ServerPassword: null }), null);
});

test("does not infer join-password protection from the admin password", () => {
  const explicitEmptyPassword = {
    AdminPassword: "admin-secret",
    ServerPassword: "",
  };
  const missingPassword = {
    AdminPassword: "admin-secret",
  };

  assert.equal(isServerPasswordProtected(explicitEmptyPassword), false);
  assert.equal(isServerPasswordProtected(missingPassword), null);
});
