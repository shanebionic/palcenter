# PalCenter

![PalCenter logo](assets/palcenter.png)

**Palworld Server Command Center**

PalCenter is a self-hosted web console for managing and monitoring existing
Palworld dedicated servers.

It connects to your existing Palworld server through the official REST API and provides a simple web interface for:

- Server monitoring
- Player tracking
- Server history
- Notifications
- Backup and restore
- User access management

PalCenter does not host or run the Palworld server itself. It connects to an existing dedicated server.

## Installation

### Unraid Community Applications

For Unraid, the recommended installation method is the official Community
Applications template:

1. Open **Apps → Community Applications** in the Unraid Web UI.
2. Search for **PalCenter**.
3. Select PalCenter, review the application settings, and install it.
4. Start the container and open `http://<unraid-ip>:3000`.

The template runs PalCenter as the non-root `nobody:users` account (`99:100`)
and maps `/mnt/user/appdata/palcenter` to `/app/data`. See the
[Unraid deployment guide](docs/UNRAID.md) for details.

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

## Documentation

Full installation, administration, backup, and troubleshooting guides are
available in the [PalCenter Wiki](https://github.com/shanebionic/palcenter/wiki).

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
