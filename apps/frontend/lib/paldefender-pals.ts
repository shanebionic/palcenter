import type { PalDefenderPalGrant } from "./api";

export interface PalGrantInput {
  palId: string;
  level: number | string;
}

export function validatePalGrant(input: PalGrantInput): string | null {
  if (!input.palId.trim()) return "Enter a Pal ID.";
  if (!/^[A-Za-z0-9_]+$/.test(input.palId.trim()))
    return "Pal IDs may contain only letters, numbers, and underscores.";
  const level = Number(input.level);
  if (!Number.isSafeInteger(level) || level <= 0)
    return "Level must be a positive whole number.";
  return null;
}

export function normalizePalGrant(input: PalGrantInput): PalDefenderPalGrant {
  return { palId: input.palId.trim(), level: Number(input.level) };
}
