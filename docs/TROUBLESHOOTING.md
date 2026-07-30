# Troubleshooting

## Collect basic information

For Docker Compose:

```bash
docker compose ps
docker compose logs --tail=200 palcenter
docker inspect palcenter --format '{{.Config.User}} {{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}'
```

Do not post `servers.json`, `notifications.json`, backup archives, cookies, or
passwords in an issue.

## Container will not start

Check:

```bash
docker compose config
docker compose logs palcenter
```

Common causes:

- the selected host port is already in use;
- an environment value is outside its documented range;
- `/app/data` is not writable by the configured UID/GID;
- an existing data file is invalid or inaccessible;
- the Docker host has no free storage.

PalCenter intentionally stops instead of starting as root or changing mount
ownership.

## Storage permission errors

Find the configured identity:

```bash
docker compose config | grep user
```

For the standard Compose named volume, use `1000:1000`. For the official
Unraid template, use `99:100`.

For a bind mount, inspect the host directory with the host's normal file tools.
It must allow the selected UID/GID to create, read, replace, and remove files.
Do not add privileged mode, the Docker socket, broad capabilities, or a root
runtime to work around the error.

## Web interface is unreachable

Check the published port:

```bash
docker compose ps
curl -I http://127.0.0.1:3000
```

If local access works but another computer cannot connect, check the Docker
host firewall and VLAN/routing policy. If a reverse proxy is involved, test the
direct web port first.

## Health endpoint fails

The direct health endpoint is:

```text
http://DOCKER-HOST:3001/api/health
```

An `ok` response means server, notification, history, automation, user, and
system configuration storage passed its checks. A `503` degraded response
means application storage is unavailable. Review logs and `/app/data`; it does
not indicate that a remote Palworld server is offline.

If port `3001` is deliberately private, run the check from the Docker host or
inside the trusted container network.

## Palworld server is offline in PalCenter

From the PalCenter host, test the configured address:

```bash
curl -i http://PALWORLD-HOST:8212/v1/api/info
```

The endpoint may require authentication; an HTTP response still confirms basic
network reachability. Then check:

- the Palworld process is running;
- `RESTAPIEnabled=True`;
- the configured REST port is correct;
- the REST URL includes `http://` or `https://`;
- firewalls and container networks allow the connection;
- the Palworld administrator password is current.

Do not use `localhost` unless Palworld runs in the same container, which is not
a supported PalCenter deployment.

## REST authentication fails

PalCenter's login password and the Palworld `AdminPassword` are different.
Edit **Connection Settings**, enter the current Palworld administrator
password, and use **Test Connection**. Saved credentials are not returned to the
browser.

If authentication still fails, confirm the Palworld configuration was saved
and the Palworld process was restarted.

## Telemetry or World Map is unavailable

Telemetry requires:

- a reachable online Palworld REST API;
- at least one connected player for current markers;
- valid X/Y values from `/players`;
- enough time for PalCenter's polling interval.

No players online is not an error. No movement history may mean the player was
absent, unchanged, outside the selected range, or older than the configured
retention. Calibration controls do not repair missing telemetry.

## Login problems

- Confirm the username rather than the email address is being used.
- Confirm the account is enabled.
- Wait 15 minutes after repeated failures; login throttling permits five failed
  attempts per source address in that window.
- Confirm browser cookies are enabled.
- If `PALCENTER_SESSION_COOKIE_SECURE=true`, access PalCenter through HTTPS.
- After a password, role, or enabled-state change, existing sessions may be
  invalidated; sign in again.

There is no default password or environment-variable password reset. If all
Administrator access is lost, restore a known-good authenticated backup or
seek recovery guidance without sharing the data files publicly.

## Reverse proxy errors

Symptoms include redirect loops, login not persisting, `403
origin_not_allowed`, or restore uploads failing.

Check:

- the proxy target is port `3000`, not `3001`;
- the public URL is a dedicated hostname, not a subpath;
- `Host` and `X-Forwarded-Proto` are forwarded;
- secure cookies are enabled only with HTTPS;
- upload limits permit the backup size;
- browser/proxy caches are not serving an old image.

See [Reverse proxy](REVERSE-PROXY.md).

## Automation did not run

Confirm the task is enabled, the time zone and **Next Run** are correct, and
PalCenter was running. After downtime, an overdue recurring task runs once and
missed occurrences are not replayed individually.

Open **View History** for the safe action snapshot and error. Verify the target
server's REST connection and credentials. See [Automation](AUTOMATION.md).

## Notification test fails

- Confirm the provider is enabled and its destination is reachable from the
  container.
- For Discord, replace the saved webhook URL if it was rotated.
- For ntfy, verify the server URL and topic.
- Check outbound firewall, DNS, TLS, and proxy policy.

Stored Discord webhook URLs cannot be displayed for comparison.

## Backup or restore fails

Confirm:

- the archive was created by a compatible PalCenter version;
- it was not unpacked or modified;
- the reverse proxy upload limit permits it;
- the archive is at most `PALCENTER_BACKUP_MAX_BYTES`;
- `/app/data` has enough free space;
- a restore was explicitly confirmed.

Invalid uploads are rejected before current data is replaced. Keep the current
container and data volume until the restore has been verified.

## Request support

Search or open an issue at
<https://github.com/shanebionic/palcenter/issues>. Include:

- PalCenter version and Production/Development channel from **About PalCenter**;
- Docker/Unraid version and CPU architecture;
- sanitized container logs;
- steps to reproduce;
- whether direct web access differs from reverse-proxy access.

For vulnerabilities, use [SECURITY.md](../SECURITY.md), not a public issue.
