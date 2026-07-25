import type {
  ConfigurationErrors,
  ConfigurationValues,
  SettingDefinition,
} from "../../types/config-generator";

export function validateConfiguration(
  settings: readonly SettingDefinition[],
  values: ConfigurationValues,
): ConfigurationErrors {
  const errors: ConfigurationErrors = {};

  for (const setting of settings) {
    const value = values[setting.key];

    if (setting.type === "boolean") {
      if (typeof value !== "boolean") {
        errors[setting.key] = "Choose an enabled or disabled value.";
      }
      continue;
    }

    if (typeof value !== "string") {
      errors[setting.key] = "Enter a valid value.";
      continue;
    }

    if (setting.type === "number") {
      if (value.trim() === "") {
        errors[setting.key] = "A numeric value is required.";
        continue;
      }

      const number = Number(value);
      if (!Number.isFinite(number)) {
        errors[setting.key] = "Enter a valid number.";
      } else if (setting.integer && !Number.isInteger(number)) {
        errors[setting.key] = "Enter a whole number.";
      } else if (setting.minimum !== undefined && number < setting.minimum) {
        errors[setting.key] = `Minimum value: ${setting.minimum}.`;
      } else if (setting.maximum !== undefined && number > setting.maximum) {
        errors[setting.key] = `Maximum value: ${setting.maximum}.`;
      }
    } else if (
      setting.type === "string" &&
      setting.maximumLength !== undefined &&
      value.length > setting.maximumLength
    ) {
      errors[setting.key] =
        `Maximum length: ${setting.maximumLength} characters.`;
    } else if (
      setting.type === "enum" &&
      !setting.options.some((option) => option.value === value)
    ) {
      errors[setting.key] = "Choose one of the supported values.";
    }
  }

  return errors;
}
