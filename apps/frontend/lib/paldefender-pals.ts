import type { PalDefenderPalEggGrant, PalDefenderPalGrant } from "./api";

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

const identifierPattern = /^[A-Za-z0-9_]+$/;
const templatePattern = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;

export interface PalTemplateGrantInput {
  palTemplate: string;
}

export function validatePalTemplateGrant(
  input: PalTemplateGrantInput,
): string | null {
  const value = input.palTemplate.trim();
  if (!value) return "Enter a Pal template filename.";
  if (!templatePattern.test(value) || value.includes(".."))
    return "Template filenames may contain only letters, numbers, dots, hyphens, and underscores.";
  return null;
}

export interface PalEggGrantInput {
  mode: "pal-id" | "template";
  eggId: string;
  palId: string;
  palTemplate: string;
  level: number | string;
}

export function validatePalEggGrant(input: PalEggGrantInput): string | null {
  if (!input.eggId.trim()) return "Enter an egg item ID.";
  if (!identifierPattern.test(input.eggId.trim()))
    return "Egg item IDs may contain only letters, numbers, and underscores.";
  if (input.mode === "pal-id") {
    if (!input.palId.trim()) return "Enter a Pal ID.";
    if (!identifierPattern.test(input.palId.trim()))
      return "Pal IDs may contain only letters, numbers, and underscores.";
  } else {
    const templateError = validatePalTemplateGrant({
      palTemplate: input.palTemplate,
    });
    if (templateError) return templateError;
  }
  if (input.level !== "") {
    const level = Number(input.level);
    if (!Number.isSafeInteger(level) || level <= 0)
      return "Level must be a positive whole number when provided.";
  }
  return null;
}

export function normalizePalEggGrant(
  input: PalEggGrantInput,
): PalDefenderPalEggGrant {
  const level = input.level === "" ? undefined : Number(input.level);
  return input.mode === "pal-id"
    ? {
        mode: "pal-id",
        eggId: input.eggId.trim(),
        palId: input.palId.trim(),
        level,
      }
    : {
        mode: "template",
        eggId: input.eggId.trim(),
        palTemplate: input.palTemplate.trim(),
        level,
      };
}
