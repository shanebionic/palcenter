import syncFs, { constants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export interface StoragePermissionWarning {
  error: unknown;
  target: string;
}

export type StoragePermissionWarningHandler = (
  warning: StoragePermissionWarning,
) => void;

export class StorageAccessError extends Error {}

interface StorageFileSystem {
  access(target: string, mode: number): Promise<void>;
  chmod(target: string, mode: number): Promise<void>;
  mkdir(
    target: string,
    options: { recursive: true; mode: number },
  ): Promise<unknown>;
  open(
    target: string,
    flags: string,
    mode: number,
  ): Promise<{
    close(): Promise<void>;
    sync(): Promise<void>;
    writeFile(contents: string, encoding: BufferEncoding): Promise<void>;
  }>;
  rm(target: string, options: { force: true }): Promise<void>;
  stat(target: string): Promise<{ isDirectory(): boolean }>;
}

const nodeFileSystem: StorageFileSystem = fs;

export async function initializeStorageDirectory(
  configDirectory: string,
  onWarning: StoragePermissionWarningHandler = () => undefined,
  fileSystem: StorageFileSystem = nodeFileSystem,
): Promise<string> {
  const directory = path.resolve(configDirectory);

  try {
    await fileSystem.mkdir(directory, { recursive: true, mode: 0o700 });
    const details = await fileSystem.stat(directory);
    if (!details.isDirectory()) {
      throw new StorageAccessError(
        `PalCenter data path "${directory}" is not a directory.`,
      );
    }
    await verifyDirectoryWritable(directory, fileSystem);
  } catch (error) {
    if (error instanceof StorageAccessError) throw error;
    throw unavailableStorageError(directory, error);
  }

  await tightenPermissions(
    directory,
    0o700,
    onWarning,
    async () => {
      await verifyDirectoryWritable(directory, fileSystem);
    },
    fileSystem,
  );

  return directory;
}

export async function tightenFilePermissions(
  target: string,
  onWarning: StoragePermissionWarningHandler = () => undefined,
  fileSystem: Pick<StorageFileSystem, "access" | "chmod"> = nodeFileSystem,
): Promise<void> {
  await tightenPermissions(
    target,
    0o600,
    onWarning,
    () => fileSystem.access(target, constants.R_OK | constants.W_OK),
    fileSystem,
  );
}

export function tightenFilePermissionsSync(
  target: string,
  onWarning: StoragePermissionWarningHandler = () => undefined,
): void {
  try {
    syncFs.chmodSync(target, 0o600);
  } catch (error) {
    try {
      syncFs.accessSync(target, constants.R_OK | constants.W_OK);
    } catch (accessError) {
      throw unavailableStorageError(target, accessError);
    }
    onWarning({ error, target });
  }
}

async function tightenPermissions(
  target: string,
  mode: number,
  onWarning: StoragePermissionWarningHandler,
  verifyUsable: () => Promise<void>,
  fileSystem: Pick<StorageFileSystem, "chmod">,
): Promise<void> {
  try {
    await fileSystem.chmod(target, mode);
  } catch (error) {
    try {
      await verifyUsable();
    } catch (accessError) {
      throw unavailableStorageError(target, accessError);
    }
    onWarning({ error, target });
  }
}

async function verifyDirectoryWritable(
  directory: string,
  fileSystem: Pick<StorageFileSystem, "open" | "rm">,
): Promise<void> {
  const probePath = path.join(
    directory,
    `.palcenter-write-test-${randomUUID()}`,
  );
  let created = false;
  let failure: unknown;

  try {
    const handle = await fileSystem.open(probePath, "wx", 0o600);
    created = true;
    try {
      await handle.writeFile("PalCenter storage test\n", "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
  } catch (error) {
    failure = error;
  }

  if (created) {
    try {
      await fileSystem.rm(probePath, { force: true });
    } catch (error) {
      failure ??= error;
    }
  }

  if (failure) throw unavailableStorageError(directory, failure);
}

function unavailableStorageError(
  target: string,
  cause: unknown,
): StorageAccessError {
  const uid = process.getuid?.();
  const gid = process.getgid?.();
  const identity =
    uid === undefined || gid === undefined
      ? "the configured container user"
      : `container UID ${uid} and GID ${gid}`;

  return new StorageAccessError(
    `PalCenter storage "${target}" is not writable by the container user. ` +
      `Confirm the bind mount is read/write and that the host share allows ${identity} to create and update files.`,
    { cause },
  );
}
