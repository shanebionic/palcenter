# Reverse proxy

Proxy only PalCenter's web interface on container port `3000`. The frontend
provides a same-origin `/api` proxy to the internal API, so port `3001` should
normally remain private.

PalCenter v1.4 uses standard HTTP requests and does not require WebSocket
upgrade forwarding.

## Production settings

When the public URL is HTTPS:

```dotenv
PALCENTER_SESSION_COOKIE_SECURE=true
```

If a trusted proxy connects directly to the API, also set:

```dotenv
PALCENTER_TRUST_PROXY=true
PALCENTER_CORS_ORIGINS=https://palcenter.example.com
```

Direct API proxying is unnecessary for the normal web application. Do not use
wildcard CORS origins, and do not enable trust-proxy mode unless every path to
the API passes through a trusted proxy.

Forward these headers:

- `Host`;
- `X-Forwarded-For`;
- `X-Forwarded-Proto`;
- `X-Forwarded-Host`.

The examples assume PalCenter is reachable from the proxy as
`palcenter:3000`. Replace that address with the correct container DNS name or
host address for your network.

## Nginx Proxy Manager

1. Create a **Proxy Host** for `palcenter.example.com`.
2. Set the scheme to `http`.
3. Set **Forward Hostname / IP** to `palcenter` or the Docker host address.
4. Set **Forward Port** to `3000`.
5. Enable **Block Common Exploits**.
6. Request or select an SSL certificate.
7. Enable **Force SSL** and HTTP/2.
8. Leave custom WebSocket support off; PalCenter does not require it.

Optional advanced Nginx configuration:

```nginx
proxy_set_header Host $host;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_read_timeout 300s;
client_max_body_size 512m;
```

`client_max_body_size` must be at least as large as the backup archive you
intend to restore and no larger than your operational policy.

## Traefik

Attach Traefik and PalCenter to the same Docker network, do not publish the API,
and add labels similar to:

```yaml
services:
  palcenter:
    image: ghcr.io/shanebionic/palcenter:latest
    networks:
      - proxy
    labels:
      - traefik.enable=true
      - traefik.http.routers.palcenter.rule=Host(`palcenter.example.com`)
      - traefik.http.routers.palcenter.entrypoints=websecure
      - traefik.http.routers.palcenter.tls=true
      - traefik.http.routers.palcenter.tls.certresolver=letsencrypt
      - traefik.http.services.palcenter.loadbalancer.server.port=3000

networks:
  proxy:
    external: true
```

Keep PalCenter's existing `/app/data`, non-root user, dropped capabilities, and
`no-new-privileges` settings when adding these labels.

## Caddy

For a Docker-network target:

```caddyfile
palcenter.example.com {
    reverse_proxy palcenter:3000
}
```

For PalCenter published on the same host:

```caddyfile
palcenter.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

Caddy supplies the standard forwarding headers automatically.

## Subpaths

Deploy PalCenter at a dedicated hostname such as
`https://palcenter.example.com`. A path prefix such as
`https://example.com/palcenter` is not a supported deployment target because
the application uses root-relative routes and assets.

## Validation

After proxy configuration:

1. Open the public HTTPS URL.
2. Sign in and refresh the page.
3. Confirm the session cookie is marked `Secure`, `HttpOnly`, and
   `SameSite=Strict`.
4. Add or test a server.
5. Create and download a backup.
6. Upload the archive far enough to reach the confirmation step; cancel unless
   performing a planned restore.
7. Confirm port `3001` is not reachable from untrusted networks.

If state-changing requests return `403 origin_not_allowed`, verify that users
are accessing only the configured hostname and that a directly proxied API has
the exact HTTPS origin in `PALCENTER_CORS_ORIGINS`.
