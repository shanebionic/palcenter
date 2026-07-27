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
