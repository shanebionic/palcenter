"use client";

import { Group, MultiSelect, Select, Stack, Text } from "@mantine/core";
import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import {
  catalogLabel,
  findCatalogEntry,
  searchCatalog,
  type CatalogEntry,
} from "../../lib/game-catalogs";

interface CatalogSelectProps {
  catalog: readonly CatalogEntry[];
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  description?: string;
  style?: CSSProperties;
}

interface CatalogMultiSelectProps {
  catalog: readonly CatalogEntry[];
  label: string;
  placeholder?: string;
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  description?: string;
}

function options(
  catalog: readonly CatalogEntry[],
  search: string,
  selected: string[],
) {
  const results = searchCatalog(catalog, search);
  const selectedEntries = selected
    .map((id) => findCatalogEntry(catalog, id))
    .filter((entry): entry is CatalogEntry => Boolean(entry));
  return [
    ...new Map(
      [...selectedEntries, ...results].map((entry) => [entry.id, entry]),
    ).values(),
  ].map((entry) => ({ value: entry.id, label: catalogLabel(entry) }));
}

function CatalogOption({ entry }: { entry: CatalogEntry }) {
  return (
    <Group gap="sm" wrap="nowrap">
      <Stack gap={0} style={{ minWidth: 0 }}>
        <Text size="sm" fw={600} truncate>
          {catalogLabel(entry)}
        </Text>
        <Text size="xs" c="dimmed" ff="monospace" truncate>
          {entry.id}
        </Text>
      </Stack>
    </Group>
  );
}

export function CatalogSelect({
  catalog,
  value,
  onChange,
  ...props
}: CatalogSelectProps) {
  const [search, setSearch] = useState("");
  const data = useMemo(
    () => options(catalog, search, value ? [value] : []),
    [catalog, search, value],
  );
  return (
    <Select
      {...props}
      searchable
      clearable
      value={value || null}
      data={data}
      searchValue={search}
      onSearchChange={setSearch}
      onChange={(next) => onChange(next ?? "")}
      nothingFoundMessage="No catalog entry matches"
      renderOption={({ option }) => {
        const entry = findCatalogEntry(catalog, option.value);
        return entry ? <CatalogOption entry={entry} /> : option.label;
      }}
    />
  );
}

export function CatalogMultiSelect({
  catalog,
  value,
  onChange,
  ...props
}: CatalogMultiSelectProps) {
  const [search, setSearch] = useState("");
  const data = useMemo(
    () => options(catalog, search, value),
    [catalog, search, value],
  );
  return (
    <MultiSelect
      {...props}
      searchable
      clearable
      value={value}
      data={data}
      searchValue={search}
      onSearchChange={setSearch}
      onChange={onChange}
      nothingFoundMessage="No catalog entry matches"
      renderOption={({ option }) => {
        const entry = findCatalogEntry(catalog, option.value);
        return entry ? <CatalogOption entry={entry} /> : option.label;
      }}
    />
  );
}
