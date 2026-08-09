import itemsDocument from "../data/catalogs/items.json";
import eggsDocument from "../data/catalogs/eggs.json";
import palsDocument from "../data/catalogs/pals.json";
import technologiesDocument from "../data/catalogs/technologies.json";

export interface CatalogEntry {
  id: string;
  name: string;
  displayName?: string;
  category?: string;
  kind?: string;
  rarityName?: string;
  schematicTier?: number;
  dexNumber?: string;
  elements?: string[];
  level?: number;
  unlockItemRecipes?: string[];
  unlockBuildObjects?: string[];
  requiredTechnology?: string;
  requiredTowerBoss?: string;
}

interface CatalogDocument {
  schemaVersion: number;
  catalog: string;
  count: number;
  items: CatalogEntry[];
}

function entries(document: unknown): readonly CatalogEntry[] {
  return (document as CatalogDocument).items;
}

export const itemCatalog = entries(itemsDocument);
export const eggCatalog = entries(eggsDocument);
export const palCatalog = entries(palsDocument);
export const technologyCatalog = entries(technologiesDocument);

export function catalogLabel(entry: CatalogEntry): string {
  return entry.displayName ?? entry.name;
}

export function catalogSearchText(entry: CatalogEntry): string {
  return [
    entry.name,
    entry.displayName,
    entry.id,
    entry.category,
    entry.kind,
    entry.rarityName,
    entry.schematicTier === undefined ? undefined : `+${entry.schematicTier}`,
    entry.dexNumber,
    ...(entry.elements ?? []),
    entry.level === undefined ? undefined : `level ${entry.level}`,
    ...(entry.unlockItemRecipes ?? []),
    ...(entry.unlockBuildObjects ?? []),
    entry.requiredTechnology,
    entry.requiredTowerBoss,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLocaleLowerCase();
}

export function searchCatalog(
  catalog: readonly CatalogEntry[],
  query: string,
  limit = 100,
): CatalogEntry[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const matches = terms.length
    ? catalog.filter((entry) => {
        const text = catalogSearchText(entry);
        return terms.every((term) => text.includes(term));
      })
    : catalog;
  return matches.slice(0, limit);
}

export function findCatalogEntry(
  catalog: readonly CatalogEntry[],
  id: string,
): CatalogEntry | undefined {
  return catalog.find((entry) => entry.id === id);
}
