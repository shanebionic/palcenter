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
  testPalDefenderConnection,
  updateServer,
  refreshCompanionStatus,
  getPlayers,
  type ConnectionTestResult,
  type PalDefenderConnectionTestResult,
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
      palDefenderEnabled: connection.palDefender.enabled,
      palDefenderEndpoint: connection.palDefender.endpoint,
      palDefenderToken: "",
      clearPalDefenderToken: false,
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
      palDefenderEndpoint: (value, values) => {
        if (!values.palDefenderEnabled) return null;
        if (!value?.trim())
          return "PalDefender endpoint is required when enabled.";
        try {
          const url = new URL(value);
          return ["http:", "https:"].includes(url.protocol) &&
            !url.username &&
            !url.password &&
            !url.search &&
            !url.hash
            ? null
            : "Use an HTTP or HTTPS URL without credentials, query, or fragment.";
        } catch {
          return "Enter a valid PalDefender endpoint.";
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
  const [palDefenderTestResult, setPalDefenderTestResult] =
    useState<PalDefenderConnectionTestResult | null>(null);
  const [palDefenderTestError, setPalDefenderTestError] = useState<
    string | null
  >(null);
  const [testingPalDefender, setTestingPalDefender] = useState(false);
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

  const testPalDefender = async () => {
    const endpointError = form.validateField("palDefenderEndpoint");
    if (endpointError.hasError || !form.values.palDefenderEndpoint) return;
    setTestingPalDefender(true);
    setPalDefenderTestResult(null);
    setPalDefenderTestError(null);
    try {
      setPalDefenderTestResult(
        await testPalDefenderConnection(connection.id, {
          endpoint: form.values.palDefenderEndpoint,
          ...(form.values.palDefenderToken
            ? { token: form.values.palDefenderToken }
            : {}),
        }),
      );
    } catch (error) {
      setPalDefenderTestError(
        error instanceof Error
          ? error.message
          : "Unable to test PalDefender connection.",
      );
    } finally {
      setTestingPalDefender(false);
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
      form.setFieldValue("palDefenderToken", "");
      form.setFieldValue("clearPalDefenderToken", false);
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
            <Stack gap="sm" mt="md">
              <Text fw={700} size="lg">
                PalDefender Integration
              </Text>
              <Text size="sm" c="dimmed">
                Configure the PalDefender REST API associated only with this
                Palworld server.
              </Text>
              <Switch
                label="Enable PalDefender"
                {...form.getInputProps("palDefenderEnabled", {
                  type: "checkbox",
                })}
              />
              <TextInput
                label="Endpoint"
                description="Include the protocol, hostname or private IP address, and PalDefender REST port."
                placeholder="http://10.10.40.20:17993"
                disabled={!form.values.palDefenderEnabled}
                {...form.getInputProps("palDefenderEndpoint")}
              />
              <PasswordInput
                label="Bearer Token"
                description={
                  connection.palDefender.tokenConfigured &&
                  !form.values.clearPalDefenderToken
                    ? "A token is configured. Leave blank to keep it, or enter a replacement."
                    : "Paste a PalDefender REST bearer token."
                }
                placeholder={
                  connection.palDefender.tokenConfigured &&
                  !form.values.clearPalDefenderToken
                    ? "Configured"
                    : "Not configured"
                }
                disabled={
                  !form.values.palDefenderEnabled ||
                  Boolean(form.values.clearPalDefenderToken)
                }
                {...form.getInputProps("palDefenderToken")}
              />
              {connection.palDefender.tokenConfigured && (
                <Button
                  type="button"
                  variant="subtle"
                  color={form.values.clearPalDefenderToken ? "gray" : "red"}
                  w="fit-content"
                  disabled={!form.values.palDefenderEnabled}
                  onClick={() =>
                    form.setFieldValue(
                      "clearPalDefenderToken",
                      !form.values.clearPalDefenderToken,
                    )
                  }
                >
                  {form.values.clearPalDefenderToken
                    ? "Keep stored token"
                    : "Clear stored token on save"}
                </Button>
              )}
              {palDefenderTestError && (
                <Alert color="orange" title="PalDefender connection failed">
                  {palDefenderTestError}
                </Alert>
              )}
              {palDefenderTestResult && (
                <Alert color="green" title="PalDefender connected">
                  Version: {palDefenderTestResult.version} · Response time:{" "}
                  {palDefenderTestResult.responseTime} ms
                </Alert>
              )}
              <Button
                type="button"
                variant="default"
                w="fit-content"
                onClick={() => void testPalDefender()}
                loading={testingPalDefender}
                disabled={
                  saving ||
                  !form.values.palDefenderEnabled ||
                  Boolean(form.values.clearPalDefenderToken)
                }
              >
                Test PalDefender Connection
              </Button>
            </Stack>
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
