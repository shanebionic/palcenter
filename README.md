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