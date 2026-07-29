import { z } from "zod";

export const defaultTelemetryRetentionDays = 30;
export const minimumTelemetryRetentionDays = 1;
export const maximumTelemetryRetentionDays = 3_650;

export const telemetryRetentionDaysSchema = z.coerce
  .number()
  .int()
  .min(minimumTelemetryRetentionDays)
  .max(maximumTelemetryRetentionDays)
  .default(defaultTelemetryRetentionDays);
