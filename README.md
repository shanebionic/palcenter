# PalCenter

![PalCenter logo](assets/palcenter.png)

**Palworld Server Command Center**

PalCenter is a self-hosted web console for managing and monitoring existing
Palworld dedicated servers.

It connects to your existing Palworld server through the official REST API and provides a simple web interface for:

- Server monitoring
- Player tracking
- Player state and location telemetry
- Server history
- Notifications
- Backup and restore
- Scheduled server automation
- User access management
- Standalone PalWorldSettings.ini generation

PalCenter does not host or run the Palworld server itself. It connects to an existing dedicated server.

## Support PalCenter

PalCenter is free and open-source software. If you find it useful, consider supporting continued development, testing, documentation, and future improvements.

[![Sponsor](https://img.shields.io/badge/Sponsor-GitHub%20Sponsors-ea4aaa?logo=github)](https://github.com/sponsors/shanebionic)

## Installation

### Unraid Community Applications

For Unraid, install PalCenter from **Apps → Community Applications**. The
official template configures the non-root `99:100` user mapping and persistent
`/mnt/user/appdata/palcenter` storage. See the
[Unraid deployment guide](docs/UNRAID.md) for upgrade and troubleshooting
instructions.

### Docker Compose

Create a `docker-compose.yml`:

```yaml
services:
  palcenter:
    image: ghcr.io/shanebionic/palcenter:latest
    container_name: palcenter
    user: "${PALCENTER_UID:-1000}:${PALCENTER_GID:-1000}"
    restart: unless-stopped

    ports:
      - "3000:3000"

    volumes:
      - palcenter-data:/app/data

volumes:
  palcenter-data:
```

Start PalCenter:

```bash
docker compose up -d
```

Open:

```text
http://YOUR_SERVER_IP:3000
```

On first launch, complete the setup wizard to create your administrator account.

### Development builds

Production users should run:

```text
ghcr.io/shanebionic/palcenter:latest
```

Testers who want the current development channel can run:

```text
ghcr.io/shanebionic/palcenter:dev
```

Development builds may contain unfinished features, are intended for testing,
and may change without notice. Each development build also has an immutable
`dev-<git-sha>` image tag. The About PalCenter dialog identifies the build as
Production or Development and includes the short commit for development builds.
Development after `v1.3.0` is identified as `v1.4.0-DEV`; production images
receive their stable version and channel from the release tag.

### Container user IDs

PalCenter runs as a non-root user. The supplied Compose deployment defaults to
UID `1000` and GID `1000`, matching the image's built-in `node` user.

To use a host bind mount owned by another non-root account, set the runtime
identity before creating the container:

```env
PALCENTER_UID=99
PALCENTER_GID=100
```

The Compose file applies these values through Docker's `user` setting. PalCenter
does not start as root and does not change ownership of mounted data. The host
directory must already be writable by the selected UID/GID. Keep `1000:1000`
when using the default Docker-managed volume.

## Requirements

- Docker
- An existing Palworld dedicated server
- Palworld REST API enabled

PalCenter v1.3 adds scheduled Broadcast Message, Save World, and Graceful
Shutdown tasks, immutable execution history, and safe editing of saved server
connections. Existing v1.2.x data remains compatible and is upgraded in place.
Download a PalCenter backup before upgrading any production installation.

## Documentation

Full installation, administration, backup, and troubleshooting guides are
available in the [PalCenter Wiki](https://github.com/shanebionic/palcenter/wiki).
The repository also includes the
[configuration generator guide](docs/CONFIGURATION-GENERATOR.md) and
[server management guide](docs/SERVER-MANAGEMENT.md). Scheduled task setup and
operation are covered in the [server automation guide](docs/AUTOMATION.md).
The initial World Intelligence storage behavior is described in the
[player telemetry guide](docs/TELEMETRY.md).

## Contributing and support

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before
opening a pull request.

Report bugs or request features through the
[issue tracker](https://github.com/shanebionic/palcenter/issues). For security
vulnerabilities, follow [SECURITY.md](SECURITY.md) instead of opening a public
issue.

## License

PalCenter is licensed under the MIT License.

See [LICENSE](LICENSE) for details.
