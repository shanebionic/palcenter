# Upgrade, backup, and rollback

PalCenter releases are designed to upgrade the persistent `/app/data` directory
in place. Create and verify a backup before changing the image.

## Before upgrading

1. Sign in as an Administrator.
2. Open **Settings → Backup & Restore**.
3. Create and download a current backup.
4. Record the current image tag:

   ```bash
   docker inspect palcenter --format '{{.Config.Image}}'
   ```

5. Review the target release notes and `CHANGELOG.md`.
6. Confirm adequate free space on the Docker host.

For predictable production deployments, use a versioned tag such as
`ghcr.io/shanebionic/palcenter:v1.4.0` rather than `latest`.

## Docker Compose upgrade

Update `PALCENTER_IMAGE` in `.env`, then:

```bash
docker compose pull
docker compose up -d
docker compose ps
docker compose logs --tail=200 palcenter
```

Do not run `docker compose down -v`; `-v` removes the named data volume.

Verify:

- `/api/health` returns `status: ok`;
- login succeeds;
- configured servers are present;
- notifications, users, metrics, events, automation, and history are present;
- one remote server connection test succeeds;
- Backup & Restore reports current data availability.

## Unraid upgrade

See [Unraid](UNRAID.md#upgrade-palcenter). Keep the
`/mnt/user/appdata/palcenter:/app/data` mapping and `99:100` runtime identity.

## Migration behavior

PalCenter initializes missing files and applies supported SQLite schema
upgrades during startup. v1.4 retains compatibility with existing connection
JSON and v1.2/v1.3 history databases. Current automation and World Intelligence
tables live in `history.sqlite`.

The current backup format is version 3. Restore also accepts format 1 and 2:

- format 1 preserves the installation's current users and system configuration;
- format 2 restores users and preserves the current system configuration;
- format 3 restores users and system configuration.

After a format-3 restore, sessions created with the replaced signing
configuration may no longer be valid; sign in again.

## Persistent data

Do not delete or replace the volume during a normal image update. Important
files include:

- `servers.json`;
- `notifications.json`;
- `history.sqlite`;
- `users.sqlite`;
- `system.json`.

Other temporary or SQLite sidecar files may exist while the application is
running. Use the application backup or stop the container before a host-level
copy.

## Rollback

Rollback is safest before the upgraded version has changed persistent schemas:

1. Stop PalCenter.
2. Preserve the upgraded `/app/data` separately for investigation.
3. Restore the pre-upgrade PalCenter archive or complete cold data copy.
4. Set `PALCENTER_IMAGE` to the exact previous version tag.
5. Recreate the container without deleting the restored volume.
6. Verify health and login.

Do not assume an older release can read a database already migrated by a newer
release. Rolling back only the image while keeping upgraded data may fail or
produce unsupported behavior.

## Backup and restore operation

The Backup page creates one `palcenter-backup-YYYY-MM-DD.tar.gz` archive.
Restore:

1. uploads the archive;
2. validates its exact file set and metadata;
3. validates JSON, SQLite integrity, users, hashes, and system configuration;
4. pauses data-dependent services;
5. replaces current data only after validation;
6. reloads services.

Restore replaces current PalCenter data. Download a current backup immediately
before proceeding and verify that the intended archive is selected.

Backups contain plaintext remote-server and notification credentials plus user
password hashes. Never attach an archive to a public issue.
