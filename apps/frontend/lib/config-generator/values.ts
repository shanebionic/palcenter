import type {
  ConfigurationPreset,
  ConfigurationValues,
  SettingDefinition,
} from "../../types/config-generator";

function defaultFormValue(setting: SettingDefinition): string | boolean {
  return setting.type === "boolean"
    ? setting.defaultValue
    : String(setting.defaultValue);
}

export function createDefaultValues(
  settings: readonly SettingDefinition[],
): ConfigurationValues {
  return Object.fromEntries(
    settings.map((setting) => [setting.key, defaultFormValue(setting)]),
  );
}

export function applyPreset(
  settings: readonly SettingDefinition[],
  preset: ConfigurationPreset,
): ConfigurationValues {
  return {
    ...createDefaultValues(settings),
    ...preset.values,
  };
}

export function resetSetting(
  values: ConfigurationValues,
  setting: SettingDefinition,
): ConfigurationValues {
  return {
    ...values,
    [setting.key]: defaultFormValue(setting),
  };
}
