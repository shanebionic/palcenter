# PalCenter

![PalCenter Logo](assets/palcenter.png)

PalCenter is a self-hosted dashboard for managing and monitoring Palworld dedicated servers.

It connects to your existing Palworld server through the official REST API and provides a simple web interface for:

- Server monitoring
- Player tracking
- Server history
- Notifications
- Backup and restore
- User access management

PalCenter does not host or run the Palworld server itself. It connects to an existing dedicated server.

---

## Quick Start

### Docker Compose

Create a `docker-compose.yml`:

```yaml
services:
  palcenter:
    image: ghcr.io/shanebionic/palcenter:latest
    container_name: palcenter
    user: "1000:1000"
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

```
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

See the [Unraid deployment guide](docs/UNRAID.md) for the standard
`99:100` configuration.

---

## Requirements

- Docker
- An existing Palworld dedicated server
- Palworld REST API enabled

---

## Documentation

Full usage documentation and guides are available in the wiki.

---

## Support

Report issues:

https://github.com/shanebionic/palcenter/issues

---

## License

PalCenter is licensed under the MIT License.

See [LICENSE](LICENSE) for details.
```
