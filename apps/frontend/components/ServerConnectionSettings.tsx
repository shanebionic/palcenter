"use client";

import {
  Alert,
  Accordion,
  Button,
  Group,
  PasswordInput,
  NumberInput,
  Switch,
  SimpleGrid,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useEffect, useState } from "react";
import {
  testServerUpdate,
  updateServer,
  refreshCompanionStatus,
  getPlayers,
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
import { CompanionStatusCard } from "./CompanionStatusCard";

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
      companionEnabled: connection.companion.enabled,
      companionHost: connection.companion.host,
      companionPort: connection.companion.port,
      companionApiToken: "",
      administratorPlayerId: connection.companion.administratorPlayerId,
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
  const [onlineCharacters, setOnlineCharacters] = useState<
    { value: string; label: string }[]
  >([]);
  useEffect(() => {
    void getPlayers(connection.id)
      .then((players) =>
        setOnlineCharacters(
          players.map((player) => ({
            value: player.playerId,
            label: `${player.name} (${player.playerId})`,
          })),
        ),
      )
      .catch(() => setOnlineCharacters([]));
  }, [connection.id]);

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
      await refreshCompanionStatus(connection.id);
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
      await refreshCompanionStatus(connection.id);
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
            <Accordion variant="separated">
              <Accordion.Item value="companion">
                <Accordion.Control>
                  Advanced Companion Connection
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack>
                    <Switch
                      label="Enable Companion discovery"
                      {...form.getInputProps("companionEnabled", {
                        type: "checkbox",
                      })}
                    />
                    <TextInput
                      label="Companion host"
                      description="Leave blank to inherit the Palworld REST host."
                      placeholder="palworld-server"
                      {...form.getInputProps("companionHost")}
                    />
                    <NumberInput
                      label="Companion port"
                      min={1}
                      max={65535}
                      {...form.getInputProps("companionPort")}
                    />
                    <PasswordInput
                      label="Companion API token"
                      description={
                        connection.companion.tokenConfigured
                          ? "A token is configured. Leave blank to keep it."
                          : "Paste the token from PalCenterCompanion.token."
                      }
                      placeholder={
                        connection.companion.tokenConfigured
                          ? "Configured"
                          : "Not configured"
                      }
                      {...form.getInputProps("companionApiToken")}
                    />
                    <Select
                      label="Administrator character"
                      description="Choose your online character by its stable in-game player ID. This is never inferred from your PalCenter account."
                      placeholder="Choose when the character is online"
                      searchable
                      clearable
                      data={onlineCharacters}
                      {...form.getInputProps("administratorPlayerId")}
                    />
                    {form.values.administratorPlayerId &&
                      !onlineCharacters.some(
                        (player) =>
                          player.value === form.values.administratorPlayerId,
                      ) && (
                        <Alert color="orange">
                          The configured administrator character is offline or
                          unavailable. Teleport actions will stay disabled.
                        </Alert>
                      )}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>

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
      <CompanionStatusCard serverId={connection.id} />
    </Stack>
  );
}
