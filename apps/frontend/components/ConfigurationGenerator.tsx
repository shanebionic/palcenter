"use client";

import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import {
  IconInfoCircle,
  IconRotate,
  IconSearch,
  IconSettings,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { CONFIGURATION_PRESETS } from "../lib/config-generator/presets";
import {
  PALWORLD_CONFIGURATION_METADATA,
  PALWORLD_SETTINGS,
} from "../lib/config-generator/schema";
import { generatePalWorldSettings } from "../lib/config-generator/serializer";
import {
  applyPreset,
  createDefaultValues,
  resetSetting,
} from "../lib/config-generator/values";
import { validateConfiguration } from "../lib/config-generator/validation";
import {
  CONFIGURATION_CATEGORIES,
  type ConfigurationPreset,
  type ConfigurationValues,
  type SettingValue,
} from "../types/config-generator";
import { ConfigurationPreview } from "./ConfigurationPreview";
import { ConfigurationSettingField } from "./ConfigurationSettingField";
import { PageHeader } from "./PageHeader";

type PendingAction =
  | { type: "reset" }
  | { type: "preset"; preset: ConfigurationPreset }
  | null;

export function ConfigurationGenerator() {
  const [values, setValues] = useState<ConfigurationValues>(() =>
    createDefaultValues(PALWORLD_SETTINGS),
  );
  const [search, setSearch] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const errors = useMemo(
    () => validateConfiguration(PALWORLD_SETTINGS, values),
    [values],
  );
  const exportContent = useMemo(
    () => generatePalWorldSettings(PALWORLD_SETTINGS, values),
    [values],
  );
  const redactedContent = useMemo(
    () =>
      generatePalWorldSettings(PALWORLD_SETTINGS, values, {
        redactSensitive: true,
      }),
    [values],
  );
  const hasSensitiveValues = PALWORLD_SETTINGS.some(
    (setting) => setting.sensitive && Boolean(values[setting.key]),
  );
  const query = search.trim().toLowerCase();
  const filteredSettings = PALWORLD_SETTINGS.filter((setting) =>
    [setting.label, setting.key, setting.description].some((value) =>
      value.toLowerCase().includes(query),
    ),
  );

  function updateValue(key: string, value: SettingValue) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function confirmPendingAction() {
    if (pendingAction?.type === "preset") {
      setValues(applyPreset(PALWORLD_SETTINGS, pendingAction.preset));
    } else if (pendingAction?.type === "reset") {
      setValues(createDefaultValues(PALWORLD_SETTINGS));
    }
    setPendingAction(null);
  }

  const pendingTitle =
    pendingAction?.type === "preset"
      ? `Apply ${pendingAction.preset.name} preset?`
      : "Reset all settings?";

  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="Tools / Server Configuration Generator"
        title="PalWorldSettings.ini Generator"
        description="Build and download a standalone Palworld server configuration without connecting to or modifying a server."
      />

      <Alert color="cyan" icon={<IconInfoCircle size={18} />}>
        All values stay in this browser tab. Nothing is saved, logged, or sent
        to the PalCenter API.
      </Alert>

      <Alert color="yellow" icon={<IconInfoCircle size={18} />}>
        This generator supports a curated subset of {PALWORLD_SETTINGS.length}{" "}
        commonly used settings, not every Palworld setting. Omitted settings
        continue to use Palworld defaults.
      </Alert>

      <Card className="pc-panel" p="lg" withBorder>
        <Stack gap="md">
          <Group justify="space-between" align="flex-start">
            <Stack gap={4}>
              <Text fw={700}>Configuration controls</Text>
              <Group gap="xs">
                <Badge variant="light">
                  Schema v{PALWORLD_CONFIGURATION_METADATA.schemaVersion}
                </Badge>
                <Text size="xs" c="dimmed">
                  {PALWORLD_CONFIGURATION_METADATA.gameVersionBasis}
                </Text>
              </Group>
            </Stack>
            <Button
              color="red"
              variant="subtle"
              leftSection={<IconRotate size={17} />}
              onClick={() => setPendingAction({ type: "reset" })}
            >
              Reset all
            </Button>
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput
              label="Search settings"
              placeholder="Name, key, or description"
              leftSection={<IconSearch size={17} />}
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
            />
            <Select
              label="Apply preset"
              placeholder="Choose a PalCenter preset"
              data={CONFIGURATION_PRESETS.map((preset) => ({
                value: preset.id,
                label: preset.name,
              }))}
              value={null}
              onChange={(id) => {
                const preset = CONFIGURATION_PRESETS.find(
                  (item) => item.id === id,
                );
                if (preset) setPendingAction({ type: "preset", preset });
              }}
            />
          </SimpleGrid>
        </Stack>
      </Card>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="xl">
        <Stack gap="lg">
          {CONFIGURATION_CATEGORIES.map((category) => {
            const settings = filteredSettings.filter(
              (setting) => setting.category === category,
            );
            if (settings.length === 0) return null;

            return (
              <Card key={category} className="pc-panel" withBorder p={0}>
                <Group p="md" className="pc-setting-category">
                  <IconSettings size={19} />
                  <Title order={2} size="h3">
                    {category}
                  </Title>
                  <Badge variant="outline">{settings.length}</Badge>
                </Group>
                <Stack gap={0}>
                  {settings.map((setting) => (
                    <ConfigurationSettingField
                      key={setting.key}
                      setting={setting}
                      value={values[setting.key]!}
                      error={errors[setting.key]}
                      onChange={(value) => updateValue(setting.key, value)}
                      onReset={() =>
                        setValues((current) => resetSetting(current, setting))
                      }
                    />
                  ))}
                </Stack>
              </Card>
            );
          })}

          {filteredSettings.length === 0 && (
            <Card className="pc-panel" p="xl" withBorder>
              <Text ta="center" c="dimmed">
                No settings match “{search}”.
              </Text>
            </Card>
          )}
        </Stack>

        <div className="pc-config-preview-column">
          <ConfigurationPreview
            exportContent={exportContent}
            redactedContent={redactedContent}
            errorCount={Object.keys(errors).length}
            hasSensitiveValues={hasSensitiveValues}
          />
        </div>
      </SimpleGrid>

      <Modal
        opened={pendingAction !== null}
        onClose={() => setPendingAction(null)}
        title={pendingTitle}
        centered
      >
        <Stack>
          <Text c="dimmed">
            This replaces every current form value. You can customize individual
            settings afterward.
          </Text>
          {pendingAction?.type === "preset" && (
            <Text size="sm">{pendingAction.preset.description}</Text>
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setPendingAction(null)}>
              Cancel
            </Button>
            <Button onClick={confirmPendingAction}>Continue</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
