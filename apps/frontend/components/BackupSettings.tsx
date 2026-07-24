"use client";

import {
  Alert,
  Anchor,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  Container,
  FileInput,
  Group,
  Modal,
  Skeleton,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createBackup, getBackupInfo, restoreBackup } from "../lib/api";
import type { BackupInfo } from "../types/servers";
import { AccountActions } from "./AccountActions";

function size(value: number | null): string {
  if (value === null) return "Unavailable";
  if (value < 1_024) return `${value} B`;
  if (value < 1_048_576) return `${(value / 1_024).toFixed(1)} KB`;
  return `${(value / 1_048_576).toFixed(1)} MB`;
}

export function BackupSettings() {
  const [info, setInfo] = useState<BackupInfo | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    try {
      setInfo(await getBackupInfo());
      setError(null);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load backup information.",
      );
    }
  }, []);

  useEffect(() => void load(), [load]);

  const download = async () => {
    setCreating(true);
    try {
      const backup = await createBackup();
      const url = URL.createObjectURL(backup.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = backup.filename;
      anchor.click();
      URL.revokeObjectURL(url);
      notifications.show({
        color: "green",
        title: "Backup created",
        message: `${backup.filename} is ready.`,
      });
      await load();
    } catch (requestError) {
      notifications.show({
        color: "red",
        title: "Backup failed",
        message:
          requestError instanceof Error
            ? requestError.message
            : "The backup could not be created.",
      });
    } finally {
      setCreating(false);
    }
  };

  const restore = async () => {
    if (!file) return;
    setRestoring(true);
    try {
      const result = await restoreBackup(file);
      setConfirming(false);
      setFile(null);
      notifications.show({
        color: "green",
        title: "Backup restored",
        message: `${result.message} Data is from ${new Date(result.metadata.createdAt).toLocaleString()}.`,
      });
      await load();
    } catch (requestError) {
      notifications.show({
        color: "red",
        title: "Restore failed",
        message:
          requestError instanceof Error
            ? requestError.message
            : "The backup could not be restored.",
      });
    } finally {
      setRestoring(false);
    }
  };

  return (
    <Container size="md" py={{ base: 32, sm: 64 }}>
      <Stack gap="xl">
        <Group justify="space-between">
          <Breadcrumbs>
            <Anchor component={Link} href="/">
              Dashboard
            </Anchor>
            <Text>Backup & Restore</Text>
          </Breadcrumbs>
          <AccountActions />
        </Group>

        <div>
          <Title order={1}>Backup & Restore</Title>
          <Text c="dimmed">
            Export or recover PalCenter configuration and historical data.
          </Text>
        </div>

        {error && <Alert color="red">{error}</Alert>}

        {!info ? (
          <Skeleton height={210} radius="md" />
        ) : (
          <Card withBorder radius="md" p="xl">
            <Stack>
              <Group justify="space-between">
                <Title order={3}>Current data</Title>
                <Badge variant="light">
                  Format v{info.backupFormatVersion} · PalCenter{" "}
                  {info.applicationVersion}
                </Badge>
              </Group>
              {Object.entries(info.data).map(([name, status]) => (
                <Group key={name} justify="space-between">
                  <Text tt="capitalize">{name}</Text>
                  <Badge
                    color={status.available ? "green" : "red"}
                    variant="light"
                  >
                    {status.available ? size(status.sizeBytes) : "Missing"}
                  </Badge>
                </Group>
              ))}
              <Button onClick={() => void download()} loading={creating}>
                Create and Download Backup
              </Button>
            </Stack>
          </Card>
        )}

        <Card withBorder radius="md" p="xl">
          <Stack>
            <Title order={3}>Restore a backup</Title>
            <Alert color="yellow">
              A restore replaces all server connections, notification settings,
              historical metrics, events, users, roles, and login credentials.
              Create a current backup first.
            </Alert>
            <FileInput
              label="PalCenter backup archive"
              description="Select a .tar.gz backup created by PalCenter."
              placeholder="Choose backup file"
              value={file}
              onChange={setFile}
              accept=".tar.gz,application/gzip"
              clearable
            />
            {file && (
              <Text size="sm" c="dimmed">
                Selected: {file.name} ({size(file.size)}) · Last modified{" "}
                {new Date(file.lastModified).toLocaleString()}
              </Text>
            )}
            <Button
              color="red"
              disabled={!file}
              onClick={() => setConfirming(true)}
            >
              Restore Backup
            </Button>
          </Stack>
        </Card>
      </Stack>

      <Modal
        opened={confirming}
        onClose={() => setConfirming(false)}
        title="Replace all current PalCenter data?"
        centered
        closeOnClickOutside={!restoring}
        closeOnEscape={!restoring}
      >
        <Stack>
          <Alert color="red">
            This replaces current configuration and history with the selected
            backup. Format v2 also replaces every user and password hash. The
            archive will be validated before any data is changed.
          </Alert>
          <Text fw={500}>{file?.name}</Text>
          <Group justify="flex-end">
            <Button
              variant="default"
              disabled={restoring}
              onClick={() => setConfirming(false)}
            >
              Cancel
            </Button>
            <Button
              color="red"
              loading={restoring}
              onClick={() => void restore()}
            >
              Confirm Restore
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
