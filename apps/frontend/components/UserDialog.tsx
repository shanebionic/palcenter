"use client";

import {
  Alert,
  Button,
  Group,
  Modal,
  PasswordInput,
  Select,
  Stack,
  Switch,
  TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useState } from "react";
import { createUser, updateUser } from "../lib/api";
import type { UserProfile, UserRole } from "../types/servers";

interface UserDialogProps {
  opened: boolean;
  user: UserProfile | null;
  onClose(): void;
  onSaved(): Promise<void>;
}

export function UserDialog({
  opened,
  user,
  onClose,
  onSaved,
}: UserDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const form = useForm({
    initialValues: {
      username: user?.username ?? "",
      email: user?.email ?? "",
      password: "",
      role: user?.role ?? ("visitor" as UserRole),
      enabled: user?.enabled ?? true,
    },
    validate: {
      username: (value) =>
        /^[a-zA-Z0-9._-]{3,80}$/.test(value.trim())
          ? null
          : "Use 3–80 valid username characters.",
      email: (value) =>
        /^\S+@\S+\.\S+$/.test(value) ? null : "Enter a valid email.",
      password: (value) =>
        user || value.length >= 12 ? null : "Use at least 12 characters.",
    },
  });

  const submit = form.onSubmit(async (values) => {
    setSubmitting(true);
    setError(null);
    try {
      const identity = {
        username: values.username.trim(),
        email: values.email.trim(),
        role: values.role,
      };
      if (user) {
        await updateUser(user.id, { ...identity, enabled: values.enabled });
      } else {
        await createUser({ ...identity, password: values.password });
      }
      await onSaved();
      onClose();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to save user.",
      );
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={user ? "Edit user" : "Create user"}
      centered
    >
      <form onSubmit={submit}>
        <Stack>
          <TextInput
            label="Username"
            required
            {...form.getInputProps("username")}
          />
          <TextInput
            label="Email"
            type="email"
            required
            {...form.getInputProps("email")}
          />
          {!user && (
            <PasswordInput
              label="Temporary password"
              description="The user must replace this password at first sign-in."
              required
              {...form.getInputProps("password")}
            />
          )}
          <Select
            label="Role"
            data={[
              { value: "administrator", label: "Administrator" },
              { value: "moderator", label: "Moderator" },
              { value: "visitor", label: "Visitor" },
            ]}
            required
            {...form.getInputProps("role")}
          />
          {user && (
            <Switch
              label="Account enabled"
              {...form.getInputProps("enabled", { type: "checkbox" })}
            />
          )}
          {error && <Alert color="red">{error}</Alert>}
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              {user ? "Save Changes" : "Create User"}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
