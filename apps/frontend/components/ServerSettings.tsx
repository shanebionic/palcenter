"use client";

import {
  Alert,
  Button,
  Card,
  Center,
  Group,
  Loader,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { IconLock } from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import { getServerSettings } from "../lib/api";
import type { ServerSettings as ServerSettingsData } from "../types/servers";

interface ServerSettingsProps {
  serverId: string;
}

interface SettingValueProps {
  label: string;
  value: string | number | null;
}

interface SettingsSectionProps {
  title: string;
  children: React.ReactNode;
}

function SettingValue({ label, value }: SettingValueProps) {
  return (
    <div>
      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
        {label}
      </Text>
      <Text>{value ?? "Unknown"}</Text>
    </div>
  );
}

function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <Card withBorder radius="md" padding="lg">
      <Stack>
        <Title order={3}>{title}</Title>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>{children}</SimpleGrid>
      </Stack>
    </Card>
  );
}

function booleanValue(value: boolean | null): string {
  if (value === null) {
    return "Unknown";
  }

  return value ? "Enabled" : "Disabled";
}

function multiplierValue(value: number | null): string {
  return value === null ? "Unknown" : `${value}×`;
}

export function ServerSettings({ serverId }: ServerSettingsProps) {
  const [settings, setSettings] = useState<ServerSettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSettings = useCallback(
    async (background = false) => {
      if (background) {
        setRefreshing(true);
      }

      setError(null);

      try {
        setSettings(await getServerSettings(serverId));
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load server settings.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [serverId],
  );

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  return (
    <Stack gap="lg" pt="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2}>Settings</Title>
          <Text c="dimmed">Read-only Palworld server configuration.</Text>
        </div>
        <Button
          variant="light"
          onClick={() => loadSettings(true)}
          loading={refreshing}
          disabled={loading}
        >
          Refresh
        </Button>
      </Group>

      {error && <Alert color="red">{error}</Alert>}

      {loading && (
        <Center mih={240}>
          <Loader />
        </Center>
      )}

      {!loading && settings && (
        <>
          <SettingsSection title="General">
            <SettingValue
              label="Server Name"
              value={settings.general.serverName}
            />
            <SettingValue
              label="Description"
              value={settings.general.description}
            />
            <SettingValue
              label="Server Version"
              value={settings.general.version}
            />
            <SettingValue label="Region" value={settings.general.region} />
          </SettingsSection>

          <SettingsSection title="Gameplay">
            <SettingValue
              label="Difficulty"
              value={settings.gameplay.difficulty}
            />
            <SettingValue
              label="Experience Multiplier"
              value={multiplierValue(settings.gameplay.experienceMultiplier)}
            />
            <SettingValue
              label="Capture Rate"
              value={multiplierValue(settings.gameplay.captureRate)}
            />
            <SettingValue
              label="Collection Drop Rate"
              value={multiplierValue(settings.gameplay.collectionDropRate)}
            />
            <SettingValue
              label="Enemy Drop Rate"
              value={multiplierValue(settings.gameplay.enemyDropRate)}
            />
            <SettingValue
              label="Day Speed"
              value={multiplierValue(settings.gameplay.daySpeed)}
            />
            <SettingValue
              label="Night Speed"
              value={multiplierValue(settings.gameplay.nightSpeed)}
            />
            <SettingValue
              label="Death Penalty"
              value={settings.gameplay.deathPenalty}
            />
          </SettingsSection>

          <SettingsSection title="Server">
            <SettingValue
              label="Maximum Players"
              value={settings.server.maxPlayers}
            />
            <SettingValue label="Public IP" value={settings.server.publicIp} />
            <SettingValue
              label="Public Port"
              value={settings.server.publicPort}
            />
            <SettingValue
              label="REST API Port"
              value={settings.server.restApiPort}
            />
            <SettingValue
              label="RCON Enabled"
              value={booleanValue(settings.server.rconEnabled)}
            />
            <SettingValue label="RCON Port" value={settings.server.rconPort} />
          </SettingsSection>

          <SettingsSection title="Security">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Password Protected
              </Text>
              <Group gap="xs">
                {settings.security.passwordProtected && (
                  <IconLock size={16} aria-label="Password protected" />
                )}
                <Text>
                  {settings.security.passwordProtected === null
                    ? "Unknown"
                    : settings.security.passwordProtected
                      ? "Protected"
                      : "Not protected"}
                </Text>
              </Group>
            </div>
          </SettingsSection>

          <SettingsSection title="Crossplay">
            <SettingValue
              label="Enabled Platforms"
              value={settings.crossplay.platforms?.join(", ") ?? null}
            />
          </SettingsSection>
        </>
      )}
    </Stack>
  );
}
