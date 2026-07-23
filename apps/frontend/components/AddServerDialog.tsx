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

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ??
  "http://localhost:3001";

interface ServerFormValues {
  name: string;
  baseUrl: string;
  adminPassword: string;
}

interface ConnectionTestResult {
  info: {
    servername: string;
    version: string;
  };
  metrics: {
    currentplayernum: number;
    maxplayernum: number;
    serverfps: number;
  };
  latencyMs: number;
}

interface ApiError {
  message?: string;
}

interface AddServerDialogProps {
  opened: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

async function readError(response: Response): Promise<string> {
  const error = (await response.json().catch(() => ({}))) as ApiError;
  return error.message ?? `Request failed with HTTP ${response.status}.`;
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
      const response = await fetch(`${apiUrl}/api/servers/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: values.baseUrl,
          adminPassword: values.adminPassword,
        }),
      });

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      const result = (await response.json()) as ConnectionTestResult;
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
      const response = await fetch(`${apiUrl}/api/servers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        throw new Error(await readError(response));
      }

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
      closeOnClickOutside={!testing && !saving}
      closeOnEscape={!testing && !saving}
    >
      <form onSubmit={saveServer}>
        <Stack>
          <TextInput
            label="Display Name"
            placeholder="The Fellas"
            required
            {...form.getInputProps("name")}
          />
          <TextInput
            label="REST URL"
            placeholder="http://10.10.10.45:8212"
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
