# Changelog

All notable PalCenter changes are documented here.

## 1.5.1

### Added

- Provider-aware player telemetry: servers with PalDefender configured
  collect player telemetry from PalDefender (world location including Z,
  level, and guild name); all other servers continue to use the native
  Palworld REST API. A configured server does not silently fall back to the
  native source.
- Interactive PalDefender base camp markers on the Palpagos map with a base
  detail card showing guild, base and guild IDs, world coordinates, and map
  coordinates, plus links to the base and guild workspaces.
- Map **Layers** menu to show or hide Players, Bases, and Trails layers.
- Collapsible desktop navigation sidebar; the collapsed state is remembered
  per browser.
- MAP COORDINATES on map player and base detail cards from PalDefender's
  authoritative map position.
- Selected-player enrichment in the map player detail card: level from
  PalDefender progression and PalDefender map coordinates.
- Context-aware return navigation from player, guild, and base detail views
  back to the workspace the administrator entered from.
- First-party Palpagos map asset (T_WorldMap derivative) with the map
  projection aligned to the authoritative DT_WorldMapUIData terrain bounds.

### Changed

- The Add Server action moved from the Dashboard to the Servers page
  (Administrators only).
- Removed the obsolete map calibration and debug UI ("Advanced map tools",
  calibration grid, and diagnostics). Map alignment is now fixed to the
  validated DT_WorldMapUIData bounds with regression-tested projection
  transforms.

### Fixed

- Repaired the history.sqlite schema migration for databases upgraded from
  1.4.0 or earlier. The `coordinate_space_id` column repairs no longer depend
  on the recorded schema version, so databases that 1.5.0 advanced to schema
  10 without `player_position_snapshots.coordinate_space_id` (and, for some
  dev builds, without `world_player_activity_state.coordinate_space_id`) are
  repaired automatically on startup. Existing rows are preserved and
  backfilled with the default coordinate space value. This resolves the
  Map/telemetry "no such column: snapshot.coordinate_space_id" 500 errors
  reported in #199.
- Repaired telemetry identity compatibility so a player no longer appears
  under two identities when PalDefender reports a PlayerUID separate from
  the platform UserId. Affected legacy telemetry rows are reconciled in
  place on the next collection.
- PalDefender telemetry polling no longer issues per-player detail requests
  for offline players.
- The Layers menu now opens correctly in expanded (full-viewport) map mode
  and stays above the expanded overlay.
- Corrected the sidebar collapse state on the first toggle, navigation-click
  collapse behavior, duplicate brand rendering, and hamburger alignment.
- Detail workspace return navigation accepts the Map tab as an entry point.

### Security

- Updated nanoid to 3.3.18 to remediate the dependency-chain advisory.

## 1.5.0

### Added

- PalDefender integration with per-server configuration for enhanced player,
  guild, and base administration.
- Player workspace with inventory, Pals, technology, progression, and
  moderation actions.
- Player resource grants: items, Pals, Pal templates, Pal eggs, and
  progression levels and points.
- Technology management: learn and forget technology with catalog selectors.
- Player moderation: kick and ban with optional IP ban, plus IP unban and
  user unban.
- Guild list and detail view with administrator, member, and base camp
  information.
- Base camp list and detail view with member roster and delete capability.
- Server broadcast, player alerts, and targeted player messages through
  PalDefender.
- PalDefender configuration reload from the server connection settings.
- Friendly Palworld catalog selectors with full-text search for items, Pals,
  eggs, and technology.
- Player level enrichment with bounded concurrency and cache invalidation.

### Changed

- Server workspace routes for Guilds and Bases are scoped to the selected
  server with canonical navigation.
- Players list displays PalDefender-enriched level data and supports direct
  kick and ban actions.
- Administration panel includes PalDefender alert, player message, and
  moderation controls alongside native REST operations.
- Removed the discontinued PalCenter Companion integration.

### Fixed

- Player levels now refresh correctly after manual Players table refresh.
- Level enrichment respects concurrency limits across large player counts.
- Inventory tab updates correctly after granting Pal eggs.
- Successful player actions are no longer misreported as failures when
  background player-list refresh encounters network issues.
- Map teleport availability, coordinate fallback, and player history display.

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
