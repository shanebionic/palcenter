# Server management

## Password protection status

PalCenter reports join-password protection from the `ServerPassword` value
returned by the official Palworld REST API:

- **Protected**: the API returned a non-empty password value.
- **Not protected**: the API explicitly returned an empty or whitespace-only
  password value.
- **Unknown**: the API omitted the value or returned `null`.

The Palworld REST API commonly omits `ServerPassword`. In that situation,
PalCenter shows **Unknown** rather than guessing from the REST administrator
password or unrelated authentication settings.

PalCenter never sends the password value to the web interface or writes it to
application logs.

## Editing a configured connection

Administrators can open a server workspace and select **Connection Settings**
to update how PalCenter reaches that server. Moderators and Visitors cannot
view or change saved connection details.

The editable fields match the Add Server workflow:

- PalCenter display name.
- REST URL, including HTTP or HTTPS protocol, hostname or IP address, and port.
- REST administrator password.

The stored password is never returned to the browser. The password field is
therefore empty when editing. Leave it blank to preserve the existing password,
or enter a replacement to update it.

Use **Test Connection** to verify the current URL and password. PalCenter
distinguishes invalid input, rejected authentication, and an unreachable host.
An Administrator may explicitly save untested or unreachable details after
confirming a warning, which supports preparing a connection while the Palworld
server is offline.

Editing updates the existing saved record atomically and preserves its server
ID. Historical metrics, server and player events, automation tasks,
notification configuration, backups, and other relationships remain
associated with the server.

**Connection Settings** only controls PalCenter's saved REST connection. The
separate **Settings** tab remains read-only and displays gameplay/server
settings reported by Palworld; editing a connection never modifies
`PalWorldSettings.ini`.

## Removing a configured server

Administrators can remove a configured server from the **Danger zone** on its
individual management page. Moderators and Visitors cannot access this action.

Removal deletes only data owned by PalCenter:

- The saved server connection and its stored REST credential.
- Historical server metrics.
- Server and player event history.
- Currently tracked player state.

The removal does not contact or modify the remote Palworld server. It does not
stop the server, uninstall anything, delete the world, or remove Palworld files.
Global PalCenter users, notification destinations, and application settings are
not changed.

Removal works when the remote server is offline. After confirmation, the server
is removed from the dashboard and remains removed after PalCenter restarts.
