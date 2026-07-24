"use client";

import {
  Alert,
  Button,
  Container,
  Image,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useEffect, useState } from "react";
import { completeSetup, getSetupStatus } from "../../lib/api";

export default function SetupPage() {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const form = useForm({
    initialValues: {
      username: "",
      email: "",
      password: "",
      passwordConfirmation: "",
    },
    validate: {
      username: (value) =>
        /^[a-zA-Z0-9._-]{3,80}$/.test(value.trim())
          ? null
          : "Use 3–80 letters, numbers, periods, underscores, or hyphens.",
      email: (value) =>
        /^\S+@\S+\.\S+$/.test(value) ? null : "Enter a valid email.",
      password: (value) =>
        value.length >= 12 ? null : "Use at least 12 characters.",
      passwordConfirmation: (value, values) =>
        value === values.password ? null : "Passwords do not match.",
    },
  });

  useEffect(() => {
    void getSetupStatus().then((status) => {
      if (!status.setupRequired) window.location.replace("/login");
    });
  }, []);

  const submit = form.onSubmit(async (values) => {
    setSubmitting(true);
    setError(null);
    try {
      await completeSetup({
        ...values,
        username: values.username.trim(),
        email: values.email.trim(),
      });
      window.location.replace("/");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to complete setup.",
      );
      setSubmitting(false);
    }
  });

  return (
    <Container size={500} py={{ base: 40, sm: 72 }}>
      <Stack gap="xl">
        <Stack align="center" gap="sm">
          <Image
            src="/assets/palcenter-logo.png"
            alt="PalCenter"
            w={104}
            h={104}
            radius="xl"
          />
          <Title order={1} ta="center">
            Set up PalCenter
          </Title>
          <Text c="dimmed" ta="center">
            Create the first Administrator account. No default credentials
            exist.
          </Text>
        </Stack>
        <Paper
          className="pc-panel"
          component="form"
          onSubmit={submit}
          withBorder
          radius="xl"
          p="xl"
        >
          <Stack>
            <TextInput
              label="Username"
              autoComplete="username"
              required
              {...form.getInputProps("username")}
            />
            <TextInput
              label="Email"
              type="email"
              autoComplete="email"
              required
              {...form.getInputProps("email")}
            />
            <PasswordInput
              label="Password"
              description="At least 12 characters with upper/lowercase, a number, and a symbol."
              autoComplete="new-password"
              required
              {...form.getInputProps("password")}
            />
            <PasswordInput
              label="Confirm password"
              autoComplete="new-password"
              required
              {...form.getInputProps("passwordConfirmation")}
            />
            {error && <Alert color="red">{error}</Alert>}
            <Button type="submit" loading={submitting}>
              Create Administrator
            </Button>
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}
