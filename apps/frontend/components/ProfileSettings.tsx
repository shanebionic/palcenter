"use client";

import {
  Alert,
  Badge,
  Button,
  Card,
  PasswordInput,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useEffect, useState } from "react";
import { changePassword, getCurrentUser } from "../lib/api";
import type { UserProfile } from "../types/servers";
import { PageHeader } from "./PageHeader";

export function ProfileSettings() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const form = useForm({
    initialValues: {
      currentPassword: "",
      newPassword: "",
      passwordConfirmation: "",
    },
    validate: {
      currentPassword: (value) =>
        value ? null : "Current password is required.",
      newPassword: (value) =>
        value.length >= 12 ? null : "Use at least 12 characters.",
      passwordConfirmation: (value, values) =>
        value === values.newPassword ? null : "Passwords do not match.",
    },
  });

  useEffect(() => {
    void getCurrentUser()
      .then(setUser)
      .catch((requestError) =>
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load profile.",
        ),
      );
  }, []);

  const submit = form.onSubmit(async (values) => {
    setSubmitting(true);
    setError(null);
    try {
      await changePassword(values);
      window.location.replace("/login");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to change password.",
      );
      setSubmitting(false);
    }
  });

  return (
    <Stack gap="xl" maw={920}>
        <PageHeader
          eyebrow="Account"
          title="Your Profile"
          description="Account details and password security."
        />
        {error && <Alert color="red">{error}</Alert>}
        {!user ? (
          <Skeleton height={180} />
        ) : (
          <>
            {user.mustChangePassword && (
              <Alert color="yellow" title="Password change required">
                Change the temporary password before accessing PalCenter.
              </Alert>
            )}
            <Card withBorder radius="md" p="xl">
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <div>
                  <Text size="xs" c="dimmed">
                    Username
                  </Text>
                  <Text fw={600}>{user.username}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">
                    Email
                  </Text>
                  <Text fw={600}>{user.email}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">
                    Role
                  </Text>
                  <Badge>{user.role}</Badge>
                </div>
                <div>
                  <Text size="xs" c="dimmed">
                    Status
                  </Text>
                  <Badge color={user.enabled ? "green" : "red"}>
                    {user.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                <div>
                  <Text size="xs" c="dimmed">
                    Created
                  </Text>
                  <Text>{new Date(user.createdAt).toLocaleString()}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">
                    Last login
                  </Text>
                  <Text>
                    {user.lastLoginAt
                      ? new Date(user.lastLoginAt).toLocaleString()
                      : "Never"}
                  </Text>
                </div>
              </SimpleGrid>
            </Card>
            <Card
              component="form"
              onSubmit={submit}
              withBorder
              radius="md"
              p="xl"
            >
              <Stack>
                <Title order={3}>Change password</Title>
                <PasswordInput
                  label="Current password"
                  autoComplete="current-password"
                  required
                  {...form.getInputProps("currentPassword")}
                />
                <PasswordInput
                  label="New password"
                  description="At least 12 characters with upper/lowercase, a number, and a symbol."
                  autoComplete="new-password"
                  required
                  {...form.getInputProps("newPassword")}
                />
                <PasswordInput
                  label="Confirm new password"
                  autoComplete="new-password"
                  required
                  {...form.getInputProps("passwordConfirmation")}
                />
                <Button type="submit" loading={submitting}>
                  Change Password
                </Button>
              </Stack>
            </Card>
          </>
        )}
    </Stack>
  );
}
