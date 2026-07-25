import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  copyConfigurationToClipboard,
  createConfigurationFile,
} from "../lib/config-generator/clipboard";
import { CONFIGURATION_PRESETS } from "../lib/config-generator/presets";
import { PALWORLD_SETTINGS } from "../lib/config-generator/schema";
import { generatePalWorldSettings } from "../lib/config-generator/serializer";
import {
  applyPreset,
  createDefaultValues,
  resetSetting,
} from "../lib/config-generator/values";
import { validateConfiguration } from "../lib/config-generator/validation";

const VERIFIED_PALSERVER_DEFAULTS = {
  ServerName: "Default Palworld Server",
  ServerDescription: "",
  ExpRate: 1,
  PalCaptureRate: 1,
  DeathPenalty: "Item",
  DayTimeSpeedRate: 1,
  NightTimeSpeedRate: 1,
  CollectionDropRate: 1,
  EnemyDropItemRate: 1,
  bEnableFastTravel: true,
  ServerPlayerMaxNum: 32,
  GuildPlayerMaxNum: 20,
  bIsPvP: false,
  bShowPlayerList: false,
  BaseCampMaxNumInGuild: 4,
  BaseCampWorkerMaxNum: 15,
  PalSpawnNumRate: 1,
  CrossplayPlatforms: "Steam,Xbox,PS5,Mac",
  PublicPort: 8211,
  RESTAPIEnabled: false,
  RESTAPIPort: 8212,
  AdminPassword: "",
  ServerPassword: "",
  bIsShowJoinLeftMessage: true,
} as const;

function requiredOutput(result: string | null): string {
  assert.notEqual(result, null);
  return result as string;
}

test("matches every displayed default from PalServer Steam build 24181105", () => {
  assert.equal(PALWORLD_SETTINGS.length, 24);
  assert.deepEqual(
    Object.fromEntries(
      PALWORLD_SETTINGS.map((setting) => [setting.key, setting.defaultValue]),
    ),
    VERIFIED_PALSERVER_DEFAULTS,
  );
});

test("matches the partial configuration accepted by PalServer build 24181105", () => {
  const values = createDefaultValues(PALWORLD_SETTINGS);
  values.ServerName = "PalCenter Partial Validation";
  values.ServerDescription =
    "PalCenter build 24181105 partial configuration validation";
  values.PublicPort = "18211";
  values.RESTAPIEnabled = true;
  values.RESTAPIPort = "18212";
  values.AdminPassword = "palcenter-validation-only";

  const generated = requiredOutput(
    generatePalWorldSettings(PALWORLD_SETTINGS, values),
  );
  const verifiedFixture = readFileSync(
    new URL(
      "./fixtures/palworld-settings-build-24181105.partial.ini",
      import.meta.url,
    ),
    "utf8",
  ).replaceAll("\r\n", "\n");

  assert.equal(generated, verifiedFixture);
});

test("serializes the default configuration with the expected structure", () => {
  const values = createDefaultValues(PALWORLD_SETTINGS);
  const result = requiredOutput(
    generatePalWorldSettings(PALWORLD_SETTINGS, values),
  );

  assert.ok(result.startsWith("[/Script/Pal.PalGameWorldSettings]\n"));
  assert.match(result, /OptionSettings=\(ServerName="Default Palworld Server"/);
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
    (first?.indexOf("ServerName=") ?? -1) < (first?.indexOf("ExpRate=") ?? -1),
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
  const casual = CONFIGURATION_PRESETS.find((preset) => preset.id === "casual");
  assert.ok(casual);

  const values = applyPreset(PALWORLD_SETTINGS, casual);

  assert.equal(values.ExpRate, "2");
  assert.equal(values.DeathPenalty, "None");
  assert.equal(values.ServerName, "Default Palworld Server");
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

test("redacts sensitive values in preview while preserving exported values", () => {
  const values = createDefaultValues(PALWORLD_SETTINGS);
  values.AdminPassword = "admin-test-value";
  values.ServerPassword = "server-test-value";

  const preview = requiredOutput(
    generatePalWorldSettings(PALWORLD_SETTINGS, values, {
      redactSensitive: true,
    }),
  );
  const exported = requiredOutput(
    generatePalWorldSettings(PALWORLD_SETTINGS, values),
  );

  assert.doesNotMatch(preview, /admin-test-value|server-test-value/);
  assert.match(preview, /AdminPassword="••••••••"/);
  assert.match(preview, /ServerPassword="••••••••"/);
  assert.match(exported, /AdminPassword="admin-test-value"/);
  assert.match(exported, /ServerPassword="server-test-value"/);
});

test("serialization does not write sensitive values to console output", () => {
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

test("reports clipboard write failures to the caller", async () => {
  const failure = new Error("Clipboard permission denied");
  await assert.rejects(
    copyConfigurationToClipboard("configuration", async () => {
      throw failure;
    }),
    failure,
  );
});

test("copy and download exports retain unredacted configuration", async () => {
  const values = createDefaultValues(PALWORLD_SETTINGS);
  values.AdminPassword = "export-test-value";
  const exported = requiredOutput(
    generatePalWorldSettings(PALWORLD_SETTINGS, values),
  );
  let copied = "";

  await copyConfigurationToClipboard(exported, async (content) => {
    copied = content;
  });
  const downloaded = await createConfigurationFile(exported).text();

  assert.match(copied, /AdminPassword="export-test-value"/);
  assert.match(downloaded, /AdminPassword="export-test-value"/);
});
