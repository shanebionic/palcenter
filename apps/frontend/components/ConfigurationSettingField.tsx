"use client";

import {
  ActionIcon,
  Alert,
  Group,
  PasswordInput,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import { IconAlertTriangle, IconRotate } from "@tabler/icons-react";
import type {
  SettingDefinition,
  SettingValue,
} from "../types/config-generator";

interface ConfigurationSettingFieldProps {
  setting: SettingDefinition;
  value: SettingValue;
  error?: string;
  onChange: (value: SettingValue) => void;
  onReset: () => void;
}

function defaultLabel(setting: SettingDefinition): string {
  if (setting.type === "boolean") {
    return setting.defaultValue ? "Enabled" : "Disabled";
  }
  if (setting.type === "enum") {
    return (
      setting.options.find((option) => option.value === setting.defaultValue)
        ?.label ?? setting.defaultValue
    );
  }
  return setting.defaultValue === "" ? "Empty" : String(setting.defaultValue);
}

function rangeDescription(setting: SettingDefinition): string | undefined {
  if (setting.type !== "number") return undefined;
  if (setting.minimum !== undefined && setting.maximum !== undefined) {
    return `Valid range: ${setting.minimum}–${setting.maximum}`;
  }
  return setting.minimum !== undefined
    ? `Minimum: ${setting.minimum}`
    : undefined;
}

export function ConfigurationSettingField({
  setting,
  value,
  error,
  onChange,
  onReset,
}: ConfigurationSettingFieldProps) {
  const description = [setting.description, rangeDescription(setting)]
    .filter(Boolean)
    .join(" ");

  return (
    <Stack gap="xs" p="md" className="pc-setting-field">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={3}>
          <Text fw={650}>{setting.label}</Text>
          <Text size="xs" ff="monospace" c="cyan.4">
            {setting.key}
          </Text>
        </Stack>
        <ActionIcon
          variant="subtle"
          color="gray"
          onClick={onReset}
          aria-label={`Reset ${setting.label} to its default`}
          title="Reset to default"
        >
          <IconRotate size={17} />
        </ActionIcon>
      </Group>

      <Text size="sm" c="dimmed">
        {description}
      </Text>

      {setting.warning && (
        <Alert color="yellow" icon={<IconAlertTriangle size={16} />} p="xs">
          <Text size="xs">{setting.warning}</Text>
        </Alert>
      )}

      {setting.type === "boolean" ? (
        <Switch
          checked={value === true}
          onChange={(event) => onChange(event.currentTarget.checked)}
          label={value === true ? "Enabled" : "Disabled"}
          aria-label={setting.label}
        />
      ) : setting.type === "enum" ? (
        <Select
          value={String(value)}
          onChange={(nextValue) => onChange(nextValue ?? "")}
          data={setting.options}
          error={error}
          aria-label={setting.label}
          allowDeselect={false}
        />
      ) : setting.type === "string" && setting.sensitive ? (
        <PasswordInput
          value={String(value)}
          onChange={(event) => onChange(event.currentTarget.value)}
          error={error}
          aria-label={setting.label}
          autoComplete="new-password"
        />
      ) : (
        <TextInput
          value={String(value)}
          onChange={(event) => onChange(event.currentTarget.value)}
          error={error}
          aria-label={setting.label}
          inputMode={setting.type === "number" ? "decimal" : "text"}
          maxLength={
            setting.type === "string" ? setting.maximumLength : undefined
          }
        />
      )}

      <Group gap="xs">
        <Text size="xs" c="dimmed">
          Palworld default: {defaultLabel(setting)}
        </Text>
        {setting.guidance && (
          <Text size="xs" c="dimmed">
            • {setting.guidance}
          </Text>
        )}
      </Group>
    </Stack>
  );
}
