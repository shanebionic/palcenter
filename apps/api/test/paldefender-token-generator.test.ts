import assert from "node:assert/strict";
import { test } from "node:test";
import {
  generatePalDefenderToken,
  PalDefenderTokenGenerationError,
  tokenFileName,
  tokenName,
} from "../src/services/paldefender-token-generator.js";
import { VISITOR_PERMISSIONS } from "../src/services/paldefender-permissions.js";

const USER_ID = "usr_9f1c2a7e-4b8d-4e0a-9c31-77aa02b6d41f";

test("token file name is stable on the immutable user id only", () => {
  assert.equal(
    tokenFileName(USER_ID),
    "PalCenter-usr_9f1c2a7e-4b8d-4e0a-9c31-77aa02b6d41f.json",
  );
  assert.ok(
    !tokenFileName(USER_ID).includes("admin"),
    "role must never appear in the file name",
  );
});

test("token name carries username plus a stable short user id, never role", () => {
  const name = tokenName(USER_ID, "alice.doe");
  assert.equal(name, "PalCenter-alice.doe-9F1C2A7E");
  assert.ok(name.length <= 59);

  // Username changes change the Name but never the file name.
  assert.equal(tokenName(USER_ID, "bob"), "PalCenter-bob-9F1C2A7E");
  assert.equal(tokenFileName(USER_ID), tokenFileName(USER_ID));

  // Unsafe username characters cannot reach the Name.
  assert.equal(
    tokenName(USER_ID, "bad/name<chars"),
    "PalCenter-bad_name_chars-9F1C2A7E",
  );

  // Long usernames are truncated for the Name.
  assert.equal(
    tokenName(USER_ID, "a".repeat(80)),
    `PalCenter-${"a".repeat(40)}-9F1C2A7E`,
  );
});

test("generation is rejected for unsupported user id formats", () => {
  assert.throws(
    () => tokenFileName("../evil"),
    PalDefenderTokenGenerationError,
  );
  assert.throws(() => tokenName("not-a-palcenter-id", "alice"));
});

test("artifact schema matches the PalDefender token file format", () => {
  const artifact = generatePalDefenderToken(USER_ID, "alice", "visitor");
  assert.equal(artifact.name, "PalCenter-alice-9F1C2A7E");
  assert.ok(/^PalCenter-usr_.+\.json$/.test(artifact.fileName));
  assert.match(artifact.token, /^[0-9a-f]{64}$/);
  const parsed = JSON.parse(artifact.fileContent) as Record<string, unknown>;
  assert.deepEqual(Object.keys(parsed), ["Name", "Token", "Permissions"]);
  assert.equal(parsed.Name, artifact.name);
  assert.equal(parsed.Token, artifact.token);
  assert.deepEqual(parsed.Permissions, [...VISITOR_PERMISSIONS].sort());
  assert.ok(artifact.fileContent.endsWith("\n"));
});

test("regeneration keeps the file name, rotates the token, and follows the current role", () => {
  const first = generatePalDefenderToken(USER_ID, "alice", "moderator");
  const second = generatePalDefenderToken(USER_ID, "alice", "moderator");
  assert.equal(first.fileName, second.fileName);
  assert.notEqual(first.token, second.token, "tokens must rotate");
  assert.equal(first.name, second.name);

  // Downgrade: same file name, new token, exactly the visitor profile.
  const downgraded = generatePalDefenderToken(USER_ID, "alice", "visitor");
  assert.equal(downgraded.fileName, first.fileName);
  assert.ok(
    ![first.token, second.token].includes(downgraded.token),
    "downgraded token must differ from previous tokens",
  );
  assert.deepEqual(
    [...downgraded.permissions],
    [...VISITOR_PERMISSIONS].sort(),
    "downgrade must produce exactly the visitor profile",
  );

  // Username change on the same user keeps the replacement file name.
  const renamed = generatePalDefenderToken(USER_ID, "renamed", "visitor");
  assert.equal(renamed.fileName, downgraded.fileName);
  assert.notEqual(renamed.name, downgraded.name);
});

test("generated permissions never include a wildcard and are sorted", () => {
  for (const role of ["visitor", "moderator", "administrator"] as const) {
    const artifact = generatePalDefenderToken(USER_ID, "alice", role);
    assert.ok(!artifact.permissions.includes("REST.*"));
    assert.deepEqual(
      [...artifact.permissions],
      [...artifact.permissions].sort(),
    );
  }
});
