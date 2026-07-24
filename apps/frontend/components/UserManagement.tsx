"use client";

import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  PasswordInput,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useCallback, useEffect, useState } from "react";
import { deleteUser, getUsers, resetUserPassword } from "../lib/api";
import type { UserProfile } from "../types/servers";
import { PageHeader } from "./PageHeader";
import { UserDialog } from "./UserDialog";

export function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selected, setSelected] = useState<UserProfile | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<UserProfile | null>(null);
  const [resetting, setResetting] = useState<UserProfile | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setUsers(await getUsers());
      setError(null);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load users.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => void load(), [load]);

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteUser(deleting.id);
      notifications.show({
        color: "green",
        title: "User deleted",
        message: `${deleting.username} was deleted.`,
      });
      setDeleting(null);
      await load();
    } catch (requestError) {
      notifications.show({
        color: "red",
        title: "Delete failed",
        message:
          requestError instanceof Error
            ? requestError.message
            : "Unable to delete user.",
      });
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    if (!resetting) return;
    setBusy(true);
    try {
      const result = await resetUserPassword(resetting.id, temporaryPassword);
      notifications.show({
        color: "green",
        title: "Password reset",
        message: result.message,
      });
      setResetting(null);
      setTemporaryPassword("");
      await load();
    } catch (requestError) {
      notifications.show({
        color: "red",
        title: "Reset failed",
        message:
          requestError instanceof Error
            ? requestError.message
            : "Unable to reset password.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack gap="xl">
        <PageHeader
          eyebrow="Access Control"
          title="User Management"
          description="Manage access, roles, and temporary passwords."
          action={
            <Button
              onClick={() => {
                setSelected(null);
                setDialogOpen(true);
              }}
            >
              Create User
            </Button>
          }
        />
        {error && <Alert color="red">{error}</Alert>}
        {loading ? (
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <Skeleton height={220} />
            <Skeleton height={220} />
          </SimpleGrid>
        ) : (
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            {users.map((user) => (
              <Card key={user.id} withBorder radius="md" p="lg">
                <Stack>
                  <Group justify="space-between">
                    <div>
                      <Title order={3}>{user.username}</Title>
                      <Text c="dimmed" size="sm">
                        {user.email}
                      </Text>
                    </div>
                    <Group gap="xs">
                      <Badge>{user.role}</Badge>
                      <Badge color={user.enabled ? "green" : "red"}>
                        {user.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </Group>
                  </Group>
                  {user.mustChangePassword && (
                    <Alert color="yellow">
                      Password change required at next sign-in.
                    </Alert>
                  )}
                  <Text size="sm" c="dimmed">
                    Created {new Date(user.createdAt).toLocaleString()} · Last
                    login{" "}
                    {user.lastLoginAt
                      ? new Date(user.lastLoginAt).toLocaleString()
                      : "Never"}
                  </Text>
                  <Group>
                    <Button
                      size="xs"
                      variant="light"
                      onClick={() => {
                        setSelected(user);
                        setDialogOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="xs"
                      variant="default"
                      onClick={() => setResetting(user)}
                    >
                      Reset Password
                    </Button>
                    <Button
                      size="xs"
                      color="red"
                      variant="light"
                      onClick={() => setDeleting(user)}
                    >
                      Delete
                    </Button>
                  </Group>
                </Stack>
              </Card>
            ))}
          </SimpleGrid>
        )}
      </Stack>

      <UserDialog
        key={`${selected?.id ?? "new"}-${dialogOpen}`}
        opened={dialogOpen}
        user={selected}
        onClose={() => setDialogOpen(false)}
        onSaved={load}
      />

      <Modal
        opened={resetting !== null}
        onClose={() => setResetting(null)}
        title="Assign temporary password"
        centered
      >
        <Stack>
          <Text>
            {resetting
              ? `Set a temporary password for ${resetting.username}. Existing sessions will be invalidated.`
              : ""}
          </Text>
          <PasswordInput
            label="Temporary password"
            description="At least 12 characters with upper/lowercase, a number, and a symbol."
            value={temporaryPassword}
            onChange={(event) =>
              setTemporaryPassword(event.currentTarget.value)
            }
          />
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => setResetting(null)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              loading={busy}
              disabled={temporaryPassword.length < 12}
              onClick={() => void resetPassword()}
            >
              Reset Password
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Delete user?"
        centered
      >
        <Stack>
          <Alert color="red">
            {deleting
              ? `Delete ${deleting.username}? Their sessions will stop working immediately.`
              : ""}
          </Alert>
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => setDeleting(null)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button color="red" loading={busy} onClick={() => void remove()}>
              Delete User
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
