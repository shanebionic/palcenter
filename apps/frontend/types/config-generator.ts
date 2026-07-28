export const CONFIGURATION_CATEGORIES = [
  "General",
  "Gameplay",
  "World",
  "Players and Guilds",
  "Bases and Pals",
  "Networking",
  "Administration",
] as const;

export type ConfigurationCategory = (typeof CONFIGURATION_CATEGORIES)[number];

export type SettingValue = string | boolean;
export type ConfigurationValues = Record<string, SettingValue>;

interface SettingOption {
  value: string;
  label: string;
}

interface BaseSettingDefinition {
  key: string;
  label: string;
  category: ConfigurationCategory;
  description: string;
  guidance?: string;
  warning?: string;
  sensitive?: boolean;
}

export interface BooleanSettingDefinition extends BaseSettingDefinition {
  type: "boolean";
  defaultValue: boolean;
}

export interface NumberSettingDefinition extends BaseSettingDefinition {
  type: "number";
  defaultValue: number;
  minimum?: number;
  maximum?: number;
  step?: number;
  precision?: number;
  integer?: boolean;
}

export interface StringSettingDefinition extends BaseSettingDefinition {
  type: "string";
  defaultValue: string;
  maximumLength?: number;
}

export interface EnumSettingDefinition extends BaseSettingDefinition {
  type: "enum";
  defaultValue: string;
  options: readonly SettingOption[];
  serialization?: "plain" | "tuple";
}

export type SettingDefinition =
  | BooleanSettingDefinition
  | NumberSettingDefinition
  | StringSettingDefinition
  | EnumSettingDefinition;

export interface ConfigurationPreset {
  id: string;
  name: string;
  description: string;
  values: Readonly<Record<string, SettingValue>>;
}

export type ConfigurationErrors = Record<string, string>;
