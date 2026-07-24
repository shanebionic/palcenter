# Changelog

All notable PalCenter changes are documented here.

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
