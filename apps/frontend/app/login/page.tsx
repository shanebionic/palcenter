"use client";

import {
  Alert,
  Button,
  Container,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useEffect, useState } from "react";
import { getSession, getSetupStatus, login } from "../../lib/api";

interface LoginFormValues {
  username: string;
  password: string;
}

function safeDestination(): string {
  const destination = new URL(window.location.href).searchParams.get("next");
  return destination?.startsWith("/") && !destination.startsWith("//")
    ? destination
    : "/";
}

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<LoginFormValues>({
    initialValues: {
      username: "",
      password: "",
    },
    validate: {
      username: (value) => (value.trim() ? null : "Username is required."),
      password: (value) => (value ? null : "Password is required."),
    },
  });

  useEffect(() => {
    void getSetupStatus().then((status) => {
      if (status.setupRequired) {
        window.location.replace("/setup");
        return;
      }
      void getSession()
        .then((session) =>
          window.location.replace(
            session.user.mustChangePassword ? "/profile" : safeDestination(),
          ),
        )
        .catch(() => undefined);
    });
  }, []);

  const submit = form.onSubmit(async (values) => {
    setSubmitting(true);
    setError(null);

    try {
      const session = await login(values.username.trim(), values.password);
      window.location.replace(
        session.user.mustChangePassword ? "/profile" : safeDestination(),
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to sign in.",
      );
      setSubmitting(false);
    }
  });

  return (
    <Container size={420} py={{ base: 64, sm: 120 }}>
      <Stack gap="xl">
        <div>
          <Title order={1} ta="center">
            PalCenter
          </Title>
          <Text c="dimmed" ta="center">
            Sign in to manage your Palworld servers.
          </Text>
        </div>

        <Paper component="form" onSubmit={submit} withBorder radius="md" p="xl">
          <Stack>
            <TextInput
              label="Username"
              autoComplete="username"
              required
              {...form.getInputProps("username")}
            />
            <PasswordInput
              label="Password"
              autoComplete="current-password"
              required
              {...form.getInputProps("password")}
            />
            {error && <Alert color="red">{error}</Alert>}
            <Button type="submit" loading={submitting} fullWidth>
              Sign in
            </Button>
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}
