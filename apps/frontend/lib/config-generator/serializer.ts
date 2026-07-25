import type {
  ConfigurationValues,
  SettingDefinition,
} from "../../types/config-generator";
import { validateConfiguration } from "./validation";

const SECTION_HEADER = "[/Script/Pal.PalGameWorldSettings]";
const REDACTED_SENSITIVE_VALUE = "••••••••";

interface SerializationOptions {
  redactSensitive?: boolean;
}

function quote(value: string): string {
  const escaped = value
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("\r", "\\r")
    .replaceAll("\n", "\\n");
  return `"${escaped}"`;
}

function serializeValue(
  setting: SettingDefinition,
  value: string | boolean,
): string {
  if (setting.type === "boolean") {
    return value ? "True" : "False";
  }

  const text = String(value);

  if (setting.type === "number") {
    const number = Number(text);
    return setting.integer
      ? String(number)
      : number.toFixed(setting.precision ?? 6);
  }

  if (setting.type === "enum") {
    return setting.serialization === "tuple" ? `(${text})` : text;
  }

  return quote(text);
}

export function generatePalWorldSettings(
  settings: readonly SettingDefinition[],
  values: ConfigurationValues,
  options: SerializationOptions = {},
): string | null {
  if (Object.keys(validateConfiguration(settings, values)).length > 0) {
    return null;
  }

  const serializedOptions = settings.map((setting) => {
    const value =
      options.redactSensitive && setting.sensitive && values[setting.key]
        ? REDACTED_SENSITIVE_VALUE
        : values[setting.key]!;
    return `${setting.key}=${serializeValue(setting, value)}`;
  });

  return `${SECTION_HEADER}\nOptionSettings=(${serializedOptions.join(",")})\n`;
}
