import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { SystemConfigurationRepository } from "../src/repositories/system-configuration-repository.js";

async function temporaryDirectory(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "palcenter-system-test-"));
}

test("generates and persists a cryptographically random session secret", async () => {
  const directory = await temporaryDirectory();
  try {
    const first = await new SystemConfigurationRepository(
      directory,
    ).initialize();
    const second = await new SystemConfigurationRepository(
      directory,
    ).initialize();

    assert.equal(first.source, "generated");
    assert.equal(
      Buffer.from(first.configuration.sessionSecret, "base64url").length,
      48,
    );
    assert.deepEqual(second.configuration, first.configuration);
    assert.equal(second.source, "stored");
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("migrates an environment secret once and stored configuration wins later", async () => {
  const directory = await temporaryDirectory();
  const legacySecret = "legacy-session-secret-at-least-32-characters";
  try {
    const migrated = await new SystemConfigurationRepository(
      directory,
    ).initialize(legacySecret);
    const restarted = await new SystemConfigurationRepository(
      directory,
    ).initialize("different-environment-secret-at-least-32-chars");

    assert.equal(migrated.source, "environment_migration");
    assert.equal(migrated.configuration.sessionSecret, legacySecret);
    assert.equal(restarted.source, "stored");
    assert.equal(restarted.configuration.sessionSecret, legacySecret);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("fails safely when stored system configuration is invalid", async () => {
  const directory = await temporaryDirectory();
  try {
    await fs.writeFile(path.join(directory, "system.json"), "{}");
    await assert.rejects(
      new SystemConfigurationRepository(directory).initialize(),
    );
    assert.equal(
      await fs.readFile(path.join(directory, "system.json"), "utf8"),
      "{}",
    );
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("concurrent initialization selects a single persisted secret", async () => {
  const directory = await temporaryDirectory();
  try {
    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        new SystemConfigurationRepository(directory).initialize(),
      ),
    );
    assert.equal(
      new Set(results.map((result) => result.configuration.sessionSecret)).size,
      1,
    );
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
