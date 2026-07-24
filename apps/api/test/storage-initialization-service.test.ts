import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  initializeStorageDirectory,
  StorageAccessError,
  tightenFilePermissions,
} from "../src/services/storage-initialization-service.js";

test("initializes a Docker-volume-style empty data directory", async () => {
  const parent = await fs.mkdtemp(
    path.join(os.tmpdir(), "palcenter-storage-test-"),
  );
  const directory = path.join(parent, "data");

  try {
    assert.equal(await initializeStorageDirectory(directory), directory);
    assert.deepEqual(await fs.readdir(directory), []);
  } finally {
    await fs.rm(parent, { recursive: true, force: true });
  }
});

test("preserves and validates an existing bind-mount-style directory", async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "palcenter-bind-test-"),
  );
  const marker = path.join(directory, "existing-data");

  try {
    await fs.writeFile(marker, "preserve me");
    await initializeStorageDirectory(directory);
    assert.equal(await fs.readFile(marker, "utf8"), "preserve me");
    assert.deepEqual(await fs.readdir(directory), ["existing-data"]);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("continues with a warning when chmod is denied but storage is writable", async () => {
  const permissionError = Object.assign(new Error("operation not permitted"), {
    code: "EPERM",
  });
  const warnings: string[] = [];
  let removed = false;

  const directory = await initializeStorageDirectory(
    "/app/data",
    ({ target }) => warnings.push(target),
    {
      async access() {},
      async chmod() {
        throw permissionError;
      },
      async mkdir() {},
      async open() {
        return {
          async close() {},
          async sync() {},
          async writeFile() {},
        };
      },
      async rm() {
        removed = true;
      },
      async stat() {
        return { isDirectory: () => true };
      },
    },
  );

  assert.equal(directory, path.resolve("/app/data"));
  assert.deepEqual(warnings, [directory]);
  assert.equal(removed, true);
});

test("fails with actionable guidance when the directory is not writable", async () => {
  const accessError = Object.assign(new Error("permission denied"), {
    code: "EACCES",
  });

  await assert.rejects(
    initializeStorageDirectory("/app/data", () => undefined, {
      async access() {},
      async chmod() {},
      async mkdir() {},
      async open() {
        throw accessError;
      },
      async rm() {},
      async stat() {
        return { isDirectory: () => true };
      },
    }),
    (error: unknown) =>
      error instanceof StorageAccessError &&
      error.message.includes("not writable by the container user") &&
      error.message.includes("bind mount is read/write"),
  );
});

test("warns instead of failing when file chmod is denied but the file is usable", async () => {
  const warnings: string[] = [];
  await tightenFilePermissions(
    "/app/data/servers.json",
    ({ target }) => warnings.push(target),
    {
      async access() {},
      async chmod() {
        throw Object.assign(new Error("operation not permitted"), {
          code: "EPERM",
        });
      },
    },
  );
  assert.deepEqual(warnings, ["/app/data/servers.json"]);
});
