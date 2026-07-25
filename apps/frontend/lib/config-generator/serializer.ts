import type {
  ConfigurationValues,
  SettingDefinition,
} from "../../types/config-generator";
import { validateConfiguration } from "./validation";

const SECTION_HEADER = "[/Script/Pal.PalGameWorldSettings]";

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
): string | null {
  if (Object.keys(validateConfiguration(settings, values)).length > 0) {
    return null;
  }

  const options = settings.map(
    (setting) =>
      `${setting.key}=${serializeValue(setting, values[setting.key]!)}`,
  );

  return `${SECTION_HEADER}\nOptionSettings=(${options.join(",")})\n`;
}
