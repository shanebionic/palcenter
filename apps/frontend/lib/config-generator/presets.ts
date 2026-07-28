import type { ConfigurationPreset } from "../../types/config-generator";

export const CONFIGURATION_PRESETS: readonly ConfigurationPreset[] = [
  {
    id: "default",
    name: "Default",
    description:
      "Restore the standard Palworld values represented by this schema.",
    values: {},
  },
  {
    id: "casual",
    name: "Casual",
    description: "Faster progression with reduced loss on death.",
    values: {
      ExpRate: "2",
      PalCaptureRate: "2",
      CollectionDropRate: "2",
      EnemyDropItemRate: "2",
      DeathPenalty: "None",
    },
  },
  {
    id: "fast-progression",
    name: "Fast Progression",
    description: "Accelerated experience, capture, and resource gathering.",
    values: {
      ExpRate: "3",
      PalCaptureRate: "2",
      CollectionDropRate: "3",
      EnemyDropItemRate: "2",
    },
  },
  {
    id: "hard",
    name: "Hard",
    description: "Slower progression with the full default death penalty.",
    values: {
      ExpRate: "0.5",
      PalCaptureRate: "0.75",
      CollectionDropRate: "0.75",
      EnemyDropItemRate: "0.75",
      DeathPenalty: "All",
    },
  },
] as const;
