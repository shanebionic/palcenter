# Changelog

All notable PalCenter changes are documented here.

## 1.4.0

### Added

- World Intelligence with a live Palpagos map, current player locations,
  selectable movement trails, and responsive map controls.
- Player Activity Summary with observed activity, movement and stationary time,
  travel distance, speed, timeline, operational flags, and clear data-quality
  context.
- Player telemetry history with separate user, player, and account identities,
  position, state, level, ping, and building count.

### Changed

- Refreshed the application surfaces with consistent cards, headers, empty
  states, responsive layouts, focus states, and administrator-focused map
  controls.
- Reduced telemetry storage growth with configurable retention, bounded
  cleanup, movement-aware writes, and periodic heartbeat snapshots.
- Improved map performance with responsive bundled assets, bounded trail
  rendering, stable marker sizing, and native AMD64/ARM64 image builds.
- Improved Backup & Restore and Automation presentation while preserving
  existing archives, tasks, schedules, and execution history.
- Expanded backup, restore, upgrade, Docker Compose, Unraid, reverse proxy,
  first-run, feature, FAQ, and troubleshooting documentation.
- Added documented Compose settings for trusted proxies and automation polling.

### Fixed

- Preserved continuous movement trails while keeping rendered line counts
  bounded and retaining the newest endpoint.
- Corrected movement-speed calculations, observed-range reporting, marker
  labels, trail fading, and player identity handling.
- Stabilized the World Map viewport, zoom, pan, Fit Map, expanded mode, and
  production CSS delivery.
- Kept World Intelligence loading, empty, offline, permission, and telemetry
  failure states actionable and accessible.

## 1.3.0

### Added

- Scheduled Broadcast Message, Save World, and Graceful Shutdown automation.
- Automation execution history with manual and scheduled triggers, results,
  durations, and immutable task/server snapshots.
- Administrator editing for saved server display names, REST URLs, and
  administrator passwords.

### Changed

- Aligned Every N Minutes schedules to wall-clock minutes with live schedule
  previews and safe migration for existing interval tasks.
- Extended backup validation and restore compatibility for automation tasks,
  execution history, and the history database schema.
- Consolidated validation and Docker workflows and gated development image
  publication on a successful Validation run.

### Fixed

- Preserved historical task, server, broadcast, and shutdown details after
  later configuration edits.
- Preserved server IDs, related history, and automation when editing saved
  connections.
- Made formatting validation deterministic across CI and Windows checkouts.

## 1.1.1

### Added

- Configurable non-root container UID/GID support, including Unraid's
  `nobody:users` mapping.

### Documentation

- Deployment guidance for standard Docker and Unraid storage ownership models.

## 1.1.0

### Changed

- Redesigned the frontend with a persistent application shell, improved
  navigation, dashboard cards, branding, and profile controls.
- Added an About dialog backed by centralized application release metadata.
- Improved Docker bind-mount compatibility while preserving non-root
  execution.

## 1.0.0

### Added

- Multi-server remote Palworld REST API management.
- Live dashboard status, health widgets, player lists, settings, and historical
  metrics and events.
- Broadcast, save, shutdown, force-stop, kick, and ban operations.
- Discord webhook and ntfy notification providers with administrator
  configuration.
- SQLite-backed users, first-run setup, Administrator/Moderator/Visitor roles,
  profiles, and password management.
- Authenticated portable backup and restore for all persistent PalCenter data.
- Production Docker, Compose, GHCR, multi-platform build, and release
  automation.

### Security

- Signed HttpOnly SameSite sessions, CSRF/origin checks, login throttling,
  backend RBAC, strict input validation, and sensitive-field log redaction.
- Automatic cryptographic session-secret generation and persistent
  owner-restricted application data.
- Validated backup archives and rollback-safe restore.
- Unprivileged container runtime with dropped capabilities and
  `no-new-privileges`.

### Migration

- Existing `PALCENTER_SESSION_SECRET` values are imported once when
  `system.json` is first created. Stored configuration takes precedence
  afterward.
- Legacy environment administrator credentials are replaced by the first-run
  SQLite user setup. Existing server, notification, and history data remain in
  the persistent volume.
- Backup formats v1 and v2 remain restorable with their documented user and
  secret-preservation behavior.
