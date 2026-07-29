# Frontend design conventions

PalCenter uses a small shared presentation layer on top of Mantine so every
workspace and command-center page follows the same dark, cyan-accented visual
language.

## Shared primitives

Use the components in `apps/frontend/components/ui` when their role matches:

- `SectionCard` for grouped page content and forms.
- `SectionHeader` for a section title, supporting text, and an optional action.
- `StatCard` for a compact label and value summary.
- `DangerCard` for destructive actions that need stronger visual separation.

Top-level routes should continue using `PageHeader`. Purpose-built surfaces such
as `ServerCard`, the world map, and activity summaries can retain their own
components when their interaction or information density requires it.

## Theme and styling

Common Mantine control defaults belong in `apps/frontend/theme.ts`. Shared
surface, page-header, tab, responsive, and state styles belong in
`apps/frontend/app/globals.css`. Avoid repeating card gradients, borders, or
control radii in individual pages.

Keep status meaning in text or icons as well as color. Interactive elements must
retain visible keyboard focus, and page or section actions must wrap below their
heading on narrower screens without creating horizontal page overflow.
