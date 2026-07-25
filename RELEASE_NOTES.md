# PalCenter v1.2.0

PalCenter v1.2.0 adds a standalone Palworld server configuration generator and includes production dependency security updates.

## Highlights

- Added a new Tools section.
- Added a responsive `PalWorldSettings.ini` configuration generator.
- Configure 24 commonly used Palworld server settings.
- Search settings by name, key, or description.
- Apply Default, Casual, Fast Progression, and Hard presets.
- Validate settings immediately.
- Reset individual settings or restore all defaults.
- Preview, copy, and download generated configuration.
- Redact passwords in the visual preview by default.
- Generate configurations entirely in the browser without modifying connected servers.

## Compatibility validation

Partial `OptionSettings` output was validated against:

- Palworld Dedicated Server Steam app `2394010`
- Steam build `24181105`
- Runtime version `v1.0.1.100619`

The generated partial configuration was accepted by PalServer, expanded to the complete effective settings set, and remained stable across a full restart.

## Security and maintenance

- Resolved production dependency audit vulnerabilities.
- Updated PostCSS to patched version `8.5.18`.
- Retained Sharp `0.35.0` to address the libvips vulnerability.
- Updated pnpm from 9.0.0 to 11.17.0.
- Moved dependency overrides to `pnpm-workspace.yaml`.
- Restricted native installation scripts to required packages.
- Production dependency audit reports no known vulnerabilities.

## Testing

- Expanded the automated test suite to 30 tests.
- Added frontend configuration-generator tests.
- Added a byte-for-byte PalServer-compatible INI fixture.
- Updated CI to run both frontend and backend tests.

## Install

```sh
docker pull ghcr.io/shanebionic/palcenter:v1.2.0
docker compose up -d