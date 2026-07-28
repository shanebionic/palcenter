# PalCenter v1.3.0

PalCenter v1.3.0 adds scheduled server automation, accurate execution history,
and safe editing for existing server connections.

## Highlights

- Added the server automation framework with friendly schedules, time zones,
  wall-clock-aligned intervals, one-time schedules, and advanced cron support.
- Added Broadcast Message automation.
- Added Save World automation.
- Added Graceful Shutdown automation with configurable wait time and message.
- Added newest-first execution history for manual and scheduled runs, including
  results, duration, safe error details, and immutable task/server snapshots.
- Added Administrator-only editing for saved server names, REST endpoints, and
  REST administrator passwords without changing server IDs.
- Improved backup and restore validation for automation tasks, execution
  history, and upgraded history databases.
- Improved CI/CD by consolidating validation and Docker builds, adding
  deterministic formatting checks, and requiring successful validation before
  development image publication.

## Upgrade notes

1. Download a current PalCenter backup.
2. Record the deployed image tag and persistent `/app/data` mapping.
3. Pull `ghcr.io/shanebionic/palcenter:v1.3.0`.
4. Recreate the container without deleting or replacing `/app/data`.
5. Confirm login, configured servers, notifications, history, and the
   Automation page.

Unraid users should retain `/mnt/user/appdata/palcenter`, UID `99`, and GID
`100`. Standard Docker Compose deployments continue to default to UID/GID
`1000:1000`.

## Compatibility and migration

- Existing `servers.json`, notification configuration, users, sessions, and
  system configuration remain compatible.
- `history.sqlite` upgrades automatically from schema version 2 to version 3 by
  adding a nullable execution-snapshot column. Existing metrics, events,
  automation tasks, and execution rows are preserved.
- History created before immutable snapshots remains readable and is identified
  as legacy metadata. New successful, failed, manual, and scheduled executions
  store credential-free snapshots.
- Existing Broadcast Message tasks remain compatible.
- Existing Every N Minutes tasks preserve their current next run. Future runs
  align to start minute `0` after execution or the next task edit.
- Backup formats v1 and v2 remain restorable. Backup format v3 includes current
  server connections, users, notifications, system configuration, automation
  tasks, and execution history.
- No Palworld server files, saves, SteamCMD installation, or Docker socket
  access are required.

## Security

- Stored Palworld administrator passwords remain backend-only and are never
  returned by connection-management APIs.
- Execution snapshots exclude REST credentials, connection URLs, notification
  credentials, and other sensitive configuration.
- The production container continues to run without root privileges, drops all
  Linux capabilities in the supplied Compose deployment, and uses
  `no-new-privileges`.

## Documentation

- [Server automation](docs/AUTOMATION.md)
- [Server management](docs/SERVER-MANAGEMENT.md)
- [Unraid deployment and upgrades](docs/UNRAID.md)
- [PalCenter Wiki](https://github.com/shanebionic/palcenter/wiki)
