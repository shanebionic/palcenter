# Features and administration

This guide describes the current v1.5.2 interface. Availability depends on the
signed-in user's role.

The desktop navigation sidebar can be collapsed to an icon rail using the
toggle at the top of the sidebar; the collapsed state is remembered per
browser.

## Dashboard

The Dashboard polls live server status and presents one card per configured
connection. Cards show the PalCenter display name, official server name,
online/offline state, players, FPS, version, response time, and last update.
Health widgets summarize live operational information without persisting that
state to `servers.json`.

One unreachable server does not prevent other cards from updating.

## Servers and workspaces

**Servers** lists saved connections. Administrators use **Add Server** to
test and save another remote REST connection. **Manage** opens one workspace
with:

- **Overview** for status, configuration, networking, uptime, and health;
- **Players** for the live player table with level enrichment;
- **Guilds** for the PalDefender guild list (requires PalDefender);
- **Bases** for the PalDefender base camp list (requires PalDefender);
- **Map** for World Intelligence;
- **Administration** for immediate server commands;
- **Settings** for read-only Palworld settings;
- **Connection Settings** for Administrator-only REST and PalDefender
  connection editing;
- **Monitoring** for historical metrics and events.

See [Server management](SERVER-MANAGEMENT.md).

## Players

Administrators and Moderators can view the connected-player table and perform
authorized player operations such as kick and ban. The table displays player
levels enriched from PalDefender when available. Visitors do not receive
operational access. Click a player to open the PalDefender Player Workspace
(see below).

## Player workspace (PalDefender)

When PalDefender is configured for a server, clicking a player opens a
six-tab workspace:

- **Overview:** player details, location, and map coordinates.
- **Inventory:** view held items and grant items using the searchable catalog.
- **Pals:** view Pals and grant Pals, Pal templates, or Pal eggs with
  friendly-name selectors.
- **Technology:** view learned technology and learn or forget technology
  entries.
- **Progression:** view character stats and grant progression levels and points.
- **Actions:** kick or ban the player with optional message, reason, and IP ban.

Catalog selectors resolve internal game IDs to friendly names for items, Pals,
eggs, and technology.

## Guilds (PalDefender)

The Guilds tab lists all guilds on the server. Select a guild to see its
administrator, member roster with levels, status, and associated base camps.
The Base Camps rows link to the linked base's Base Details page. This is a
read-only view.

## Base camps (PalDefender)

The Bases tab lists all base camps. Select a base to see its level, position,
guild, and member roster. Administrators can delete a base camp with a
confirmation dialog. Operators can open **View on map** from Base Details to
jump straight to the living world map with that base selected and centered
(`?tab=map&base={baseId}` links carry the base ID only, never coordinates).
On the World Tree view, a known base shows **View on Palpagos** instead,
because base positions are located on Palpagos.

## World Map

The Map plots currently connected players using position telemetry. Select a
player marker for details, including PalDefender map coordinates and level
when available. When PalDefender is configured for a server, its base camps
also appear as interactive markers; select a base for its guild, IDs, world
and map coordinates, and links to the base and guild workspaces.

Use the **Layers** menu to show or hide the Players, Bases, and Trails
layers (Players and Bases are on by default; Trails follows the selected
movement trail). Use Fit Map, zoom, pan, Center Player, and expanded mode to
navigate. The world map selector offers Palpagos and World Tree. Each map
plots only players from its own coordinate space; players located in the
other supported map are listed under **Players on other maps** with a
**View on ...** action, and players PalCenter cannot locate are listed under
**Location unavailable**. Selecting a player never changes the active map;
explicit **View on ...**, **Follow Player**, or **Center Player** switches to
the selected player's map.

A base deep link (`?tab=map&base={baseId}`) selects and centers that base on
the active map when it can be shown, or explains why it cannot: **Base not
found** (the base is no longer in the PalDefender base data) or **Location
unavailable** (the base layer is unavailable, the coordinates are unusable, or
the active map cannot display bases). See
[docs/WORLD-MAP.md](WORLD-MAP.md).

Administrators and Moderators can view map/history data.

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

When PalDefender is configured, additional operations are available:

- send a server-wide alert to all connected players;
- send targeted messages to selected players with multiple message types;
- broadcast a PalDefender message to the server;
- reload PalDefender's plugin configuration;
- unban a player or lift an IP ban.

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

## User Management

Administrators create, edit, and delete users, reset temporary passwords, and
assign per-user PalDefender credentials.

Each PalCenter user can have one PalDefender bearer token per server. When a
user performs a PalDefender action, PalCenter uses that user's assigned token
for this server; users without an assignment, and background collection, use
the server's PalDefender token. A request made with an assigned token never
falls back to the server token: an invalid token reports
`paldefender_credential_invalid`, and a token missing a required permission
reports `paldefender_permission_denied` with the missing permission name.
Tokens are write-only: assignment and list responses never return token
material, and deleting a user or a server removes its credential rows.

### Generated PalDefender token files

Because PalDefender has no REST endpoint for creating its own tokens,
Administrators can generate a ready-to-install PalDefender token file for any
PalCenter user from the same **PalDefender user credentials** panel. Use
**Generate Token** on a user's row.

- The file grants the permission profile of the user's current role:
  **Visitor** receives read-only permission, **Moderator** adds the
  operating permissions (kick, ban, give, message, and so on), and
  **Administrator** adds base deletion and configuration reload. Generated
  files never include the `REST.*` wildcard.
- The token value is random and is shown exactly once, as the file content,
  in a one-time dialog. PalCenter does not store or log the token value or
  the file content.
- Optionally, the same action can assign the token to that user's PalDefender
  requests immediately; by default it only creates the file.
- To install, save the shown content as the file name PalCenter displays in
  the PalDefender server's `RESTAPI\Tokens` folder, then restart PalDefender
  or reload its configuration.
- If the user's role changes later, generate again to replace the file. The
  replacement uses the same file name, a new token, and the new role's
  permissions, so the installed file's permissions always match the current
  role.

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
