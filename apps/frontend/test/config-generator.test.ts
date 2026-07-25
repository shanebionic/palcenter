import assert from "node:assert/strict";
import test from "node:test";
import { CONFIGURATION_PRESETS } from "../lib/config-generator/presets";
import { PALWORLD_SETTINGS } from "../lib/config-generator/schema";
import { generatePalWorldSettings } from "../lib/config-generator/serializer";
import {
  applyPreset,
  createDefaultValues,
  resetSetting,
} from "../lib/config-generator/values";
import { validateConfiguration } from "../lib/config-generator/validation";

function requiredOutput(result: string | null): string {
  assert.notEqual(result, null);
  return result as string;
}

test("serializes the default configuration with the expected structure", () => {
  const values = createDefaultValues(PALWORLD_SETTINGS);
  const result = requiredOutput(
    generatePalWorldSettings(PALWORLD_SETTINGS, values),
  );

  assert.ok(result.startsWith("[/Script/Pal.PalGameWorldSettings]\n"));
  assert.match(result, /OptionSettings=\(ServerName="Palworld Server"/);
  assert.match(result, /ExpRate=1\.000000/);
  assert.match(result, /CrossplayPlatforms=\(Steam,Xbox,PS5,Mac\)/);
});

test("serializes changed numeric and boolean settings", () => {
  const values = createDefaultValues(PALWORLD_SETTINGS);
  values.ExpRate = "2.5";
  values.bEnableFastTravel = false;

  const result = requiredOutput(
    generatePalWorldSettings(PALWORLD_SETTINGS, values),
  );

  assert.match(result, /ExpRate=2\.500000/);
  assert.match(result, /bEnableFastTravel=False/);
});

test("escapes quoted strings, backslashes, newlines, and preserves commas", () => {
  const values = createDefaultValues(PALWORLD_SETTINGS);
  values.ServerDescription = 'Line "one", path C:\\Palworld\nLine two';

  const result = requiredOutput(
    generatePalWorldSettings(PALWORLD_SETTINGS, values),
  );

  assert.match(
    result,
    /ServerDescription="Line \\"one\\", path C:\\\\Palworld\\nLine two"/,
  );
});

test("uses deterministic schema ordering", () => {
  const values = createDefaultValues(PALWORLD_SETTINGS);
  const first = generatePalWorldSettings(PALWORLD_SETTINGS, values);
  const second = generatePalWorldSettings(PALWORLD_SETTINGS, { ...values });

  assert.equal(first, second);
  assert.ok(
    (first?.indexOf("ServerName=") ?? -1) <
      (first?.indexOf("ExpRate=") ?? -1),
  );
});

test("invalid values prevent generated output", () => {
  const values = createDefaultValues(PALWORLD_SETTINGS);
  values.PublicPort = "70000";

  const errors = validateConfiguration(PALWORLD_SETTINGS, values);

  assert.equal(errors.PublicPort, "Maximum value: 65535.");
  assert.equal(generatePalWorldSettings(PALWORLD_SETTINGS, values), null);
});

test("applies presets as data over complete defaults", () => {
  const casual = CONFIGURATION_PRESETS.find(
    (preset) => preset.id === "casual",
  );
  assert.ok(casual);

  const values = applyPreset(PALWORLD_SETTINGS, casual);

  assert.equal(values.ExpRate, "2");
  assert.equal(values.DeathPenalty, "None");
  assert.equal(values.ServerName, "Palworld Server");
});

test("resets an individual setting to its default", () => {
  const values = createDefaultValues(PALWORLD_SETTINGS);
  values.ExpRate = "4";
  const setting = PALWORLD_SETTINGS.find((item) => item.key === "ExpRate");
  assert.ok(setting);

  const result = resetSetting(values, setting);

  assert.equal(result.ExpRate, "1");
  assert.equal(values.ExpRate, "4");
});

test("sensitive configuration utilities do not persist or log values", () => {
  const messages: unknown[] = [];
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  console.log = (...values) => messages.push(...values);
  console.warn = (...values) => messages.push(...values);
  console.error = (...values) => messages.push(...values);

  try {
    const values = createDefaultValues(PALWORLD_SETTINGS);
    values.AdminPassword = "test-value-not-a-real-password";
    const result = requiredOutput(
      generatePalWorldSettings(PALWORLD_SETTINGS, values),
    );
    assert.match(result, /AdminPassword="test-value-not-a-real-password"/);
    assert.deepEqual(messages, []);
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
  }
});
