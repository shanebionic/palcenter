# Features and administration

This guide describes the current v1.4.0 interface. Availability depends on the
signed-in user's role.

## Dashboard

The Dashboard polls live server status and presents one card per configured
connection. Cards show the PalCenter display name, official server name,
online/offline state, players, FPS, version, response time, and last update.
Health widgets summarize live operational information without persisting that
state to `servers.json`.

Use **Add Server** to test and save another remote REST connection. One
unreachable server does not prevent other cards from updating.

## Servers and workspaces

**Servers** lists saved connections. **Manage** opens one workspace with:

- **Overview** for status, configuration, networking, uptime, and health;
- **Players** for the live player table;
- **Map** for World Intelligence;
- **Administration** for immediate server commands;
- **Settings** for read-only Palworld settings;
- **Connection Settings** for Administrator-only REST connection editing;
- **Monitoring** for historical metrics and events.

See [Server management](SERVER-MANAGEMENT.md).

## Players

Administrators and Moderators can view the connected-player table and perform
authorized player operations such as kick and ban. Visitors do not receive
operational access. PalCenter sends commands to the official REST API; it does
not edit save files.

## World Map

The Map plots currently connected players using position telemetry from the
official `/players` response. Select a marker for player details. Use Fit Map,
zoom, pan, Center Player, and expanded mode to navigate.

Administrators and Moderators can view map/history data. Administrator-only
calibration controls are collapsed under **Advanced map tools**.

## Player Activity Summary

Enable a movement trail for a selected player and range. The summary keeps the
classification, operational flags, selected range, observed span, approximate
distance, and online state visible. Detailed statistics, timelines, insights,
and trail data are expandable.

The summary is deterministic and based only on available telemetry. It does
not infer player intent. See [World Map](WORLD-MAP.md) and
[Telemetry](TELEMETRY.md).

## Administration

Supported immediate operations are:

- broadcast a message;
- save the world;
- graceful shutdown with a wait and optional message;
- force stop;
- kick a player;
- ban a player.

PalCenter does not start the Palworld process, restart containers, update the
server, or manage save files.

## Automation

Automation schedules Broadcast Message, Save World, and Graceful Shutdown
across configured servers. It records successful and failed executions with an
immutable safe snapshot of what ran. Only Administrators can change or execute
tasks; all signed-in roles can view the Automation page.

See [Automation](AUTOMATION.md).

## Monitoring and events

PalCenter periodically records server metrics and significant server/player
events in `history.sqlite`. Current status is still fetched live. Historical
data supports the Monitoring page, automation history, World Intelligence, and
notifications.

## Notifications

Administrators can configure:

- **Discord webhook:** display name, webhook URL, enabled state, and events;
- **ntfy:** display name, server URL, topic, enabled state, and events.

Supported events are server online, offline, restarted, player joined, player
left, and player banned. Providers can be enabled/disabled and tested.

Saved Discord webhook URLs are not displayed after creation. Enter a new URL
only to replace the stored value. Provider delivery and event generation remain
backend responsibilities.

## Backup and Restore

Administrators can create, download, inspect, upload, and restore one portable
archive. Current format-v3 backups contain:

- `servers.json`;
- `notifications.json`;
- `history.sqlite`;
- `users.sqlite`;
- `system.json`;
- `metadata.json`.

Restore validates metadata, file membership, JSON, SQLite integrity, users, and
system configuration before replacing current data. Current services pause
during the operation. Store archives securely because they contain credentials
and password hashes.

See [Upgrading](UPGRADING.md).

## Authentication and profiles

The initial setup creates the first Administrator. Each user can view their
profile and change their password by providing the current password.

| Role          | Intended use                                                                             |
| ------------- | ---------------------------------------------------------------------------------------- |
| Administrator | Full setup, configuration, user, notification, backup, server, and automation management |
| Moderator     | Operational server/player access plus authorized World Intelligence history              |
| Visitor       | Read-only status and configuration access                                                |

The API enforces permissions; controls are not protected solely by frontend
visibility. PalCenter protects the last enabled Administrator from deletion or
disablement.

## Settings and tools

The application Settings area contains Administrator-facing user,
notification, and backup management. The server workspace's **Settings** tab is
read-only Palworld configuration.

The **Tools** page includes the Palworld server configuration generator. It
edits a documented curated subset of 24 commonly used settings and generates a
verified standalone partial `OptionSettings` structure. Omitted values use
Palworld defaults. Preview passwords are redacted; copied and downloaded output
contains the configured plaintext values.

See [Configuration generator](CONFIGURATION-GENERATOR.md).
