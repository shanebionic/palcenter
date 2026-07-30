"use client";

import {
  Alert,
  Button,
  Group,
  PasswordInput,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useState } from "react";
import {
  testServerUpdate,
  updateServer,
  type ConnectionTestResult,
  type ServerConnectionUpdate,
} from "../lib/api";
import {
  serverConnectionPayload,
  untestedConnectionWarning,
} from "../lib/server-connection";
import type { PublicConnection } from "../types/servers";
import { SectionCard } from "./ui/SectionCard";
import { SectionHeader } from "./ui/SectionHeader";

interface ServerConnectionSettingsProps {
  connection: PublicConnection;
  onSaved(): Promise<void>;
}

export function ServerConnectionSettings({
  connection,
  onSaved,
}: ServerConnectionSettingsProps) {
  const form = useForm<ServerConnectionUpdate>({
    initialValues: {
      name: connection.name,
      baseUrl: connection.baseUrl,
      adminPassword: "",
    },
    validate: {
      name: (value) => (value.trim() ? null : "Display name is required."),
      baseUrl: (value) => {
        try {
          const url = new URL(value);
          return ["http:", "https:"].includes(url.protocol)
            ? null
            : "Use an HTTP or HTTPS REST URL.";
        } catch {
          return "Enter a valid REST URL.";
        }
      },
    },
  });
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(
    null,
  );
  const [testedKey, setTestedKey] = useState("");
  const [testError, setTestError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const connectionKey = (values: ServerConnectionUpdate) =>
    `${values.baseUrl}\u0000${values.adminPassword ?? ""}`;
  const currentTested = testedKey === connectionKey(form.values);

  const test = async () => {
    const validation = form.validate();
    if (validation.hasErrors) return;
    setTesting(true);
    setTestResult(null);
    setTestError(null);
    try {
      const result = await testServerUpdate(connection.id, {
        baseUrl: form.values.baseUrl,
        adminPassword: form.values.adminPassword ?? "",
      });
      setTestResult(result);
      setTestedKey(connectionKey(form.values));
    } catch (error) {
      setTestError(
        error instanceof Error ? error.message : "Unable to test connection.",
      );
      setTestedKey("");
    } finally {
      setTesting(false);
    }
  };

  const save = form.onSubmit(async (values) => {
    if (!currentTested && !window.confirm(untestedConnectionWarning)) {
      return;
    }
    setSaving(true);
    try {
      await updateServer(connection.id, serverConnectionPayload(values));
      notifications.show({
        color: "teal",
        title: "Connection updated",
        message: "The saved PalCenter connection was updated.",
      });
      form.setFieldValue("adminPassword", "");
      setTestedKey("");
      setTestResult(null);
      await onSaved();
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Unable to update connection",
        message: error instanceof Error ? error.message : "The update failed.",
      });
    } finally {
      setSaving(false);
    }
  });

  return (
    <Stack gap="lg" pt="lg">
      <SectionHeader
        title="Connection Settings"
        description="Edit how PalCenter connects to this server. These settings do not modify PalWorldSettings.ini or remote gameplay configuration."
      />

      <SectionCard>
        <form onSubmit={save}>
          <Stack>
            <TextInput
              label="Display name"
              required
              {...form.getInputProps("name")}
            />
            <TextInput
              label="REST URL"
              description="Include the protocol, hostname or IP address, and REST API port."
              placeholder="http://your-server-ip:8212"
              required
              {...form.getInputProps("baseUrl")}
            />
            <PasswordInput
              label="REST administrator password"
              description="Leave blank to keep the currently stored password."
              {...form.getInputProps("adminPassword")}
            />

            {testError && (
              <Alert color="orange" title="Connection test failed">
                {testError} You may still save after confirming the warning.
              </Alert>
            )}
            {testResult && currentTested && (
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
                type="button"
                variant="default"
                onClick={() => void test()}
                loading={testing}
                disabled={saving}
              >
                Test Connection
              </Button>
              <Button
                type="submit"
                loading={saving}
                disabled={testing || !form.values.name.trim()}
              >
                Save Connection
              </Button>
            </Group>
          </Stack>
        </form>
      </SectionCard>
    </Stack>
  );
}
