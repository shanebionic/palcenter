"use client";

import {
  Alert,
  Button,
  Group,
  Modal,
  PasswordInput,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useState } from "react";
import {
  addServer,
  testServer,
  type ConnectionTestResult,
  type ServerConnectionInput,
} from "../lib/api";

type ServerFormValues = ServerConnectionInput;

interface AddServerDialogProps {
  opened: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export function AddServerDialog({
  opened,
  onClose,
  onSaved,
}: AddServerDialogProps) {
  const form = useForm<ServerFormValues>({
    initialValues: {
      name: "",
      baseUrl: "",
      adminPassword: "",
    },
    validate: {
      name: (value) => (value.trim() ? null : "Display name is required."),
      baseUrl: (value) => {
        try {
          new URL(value);
          return null;
        } catch {
          return "Enter a valid REST URL.";
        }
      },
      adminPassword: (value) => (value ? null : "Admin password is required."),
    },
  });
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(
    null,
  );
  const [testedCredentials, setTestedCredentials] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const credentialKey = (values: ServerFormValues) =>
    `${values.baseUrl}\u0000${values.adminPassword}`;

  const close = () => {
    if (testing || saving) {
      return;
    }

    form.reset();
    setTestResult(null);
    setTestedCredentials("");
    setError(null);
    onClose();
  };

  const testConnection = async () => {
    const validation = form.validate();
    if (validation.hasErrors) {
      return;
    }

    const values = form.getValues();
    setTesting(true);
    setError(null);
    setTestResult(null);

    try {
      const result = await testServer({
        baseUrl: values.baseUrl,
        adminPassword: values.adminPassword,
      });

      setTestResult(result);
      setTestedCredentials(credentialKey(values));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to test the server.",
      );
    } finally {
      setTesting(false);
    }
  };

  const saveServer = form.onSubmit(async (values) => {
    if (credentialKey(values) !== testedCredentials) {
      setTestResult(null);
      setError("Test the current REST URL and password before saving.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await addServer(values);
      await onSaved();
      close();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to save the server.",
      );
    } finally {
      setSaving(false);
    }
  });

  const currentCredentialsTested =
    credentialKey(form.values) === testedCredentials;

  return (
    <Modal
      opened={opened}
      onClose={close}
      title="Add Palworld server"
      size="lg"
      closeOnClickOutside={!testing && !saving}
      closeOnEscape={!testing && !saving}
    >
      <form onSubmit={saveServer}>
        <Stack>
          <TextInput
            label="Display Name"
            placeholder="My Palworld Server"
            required
            {...form.getInputProps("name")}
          />
          <TextInput
            label="REST URL"
            placeholder="http://your-server-ip:8212"
            description="The Palworld REST API address, including its port."
            required
            {...form.getInputProps("baseUrl")}
          />
          <PasswordInput
            label="Admin Password"
            required
            {...form.getInputProps("adminPassword")}
          />

          {error && <Alert color="red">{error}</Alert>}

          {testResult && currentCredentialsTested && (
            <Alert color="green" title="Connection successful">
              <Stack gap={4}>
                <Text size="sm">{testResult.info.servername}</Text>
                <SimpleGrid cols={2} spacing={4}>
                  <Text size="sm">Version: {testResult.info.version}</Text>
                  <Text size="sm">
                    Players: {testResult.metrics.currentplayernum}/
                    {testResult.metrics.maxplayernum}
                  </Text>
                  <Text size="sm">FPS: {testResult.metrics.serverfps}</Text>
                  <Text size="sm">Latency: {testResult.latencyMs} ms</Text>
                </SimpleGrid>
              </Stack>
            </Alert>
          )}

          <Group justify="space-between">
            <Button
              variant="default"
              onClick={testConnection}
              loading={testing}
              disabled={saving}
            >
              Test Connection
            </Button>
            <Group>
              <Button
                variant="subtle"
                onClick={close}
                disabled={testing || saving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={saving}
                disabled={!testResult || !currentCredentialsTested || testing}
              >
                Save
              </Button>
            </Group>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
