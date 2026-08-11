import type { PalDefenderItemGrant } from "./api";

export interface ItemGrantInput {
  itemId: string;
  count: number | string;
}

export function validateItemGrants(inputs: ItemGrantInput[]): string | null {
  if (inputs.length === 0) return "Add at least one item.";
  for (const input of inputs) {
    if (!input.itemId.trim()) return "Enter an Item ID for every item.";
    if (!/^[A-Za-z0-9_]+$/.test(input.itemId.trim()))
      return "Item IDs may contain only letters, numbers, and underscores.";
    const count = Number(input.count);
    if (!Number.isSafeInteger(count) || count <= 0)
      return "Quantities must be positive whole numbers.";
  }
  return null;
}

export function normalizeItemGrants(
  inputs: ItemGrantInput[],
): PalDefenderItemGrant[] {
  return inputs.map((input) => ({
    itemId: input.itemId.trim(),
    count: Number(input.count),
  }));
}
