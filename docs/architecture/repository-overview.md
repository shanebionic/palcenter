# Repository overview

PalCenter is a pnpm workspace with a Next.js frontend and Fastify API. The
browser uses same-origin `/api/*` routes, and the API owns authentication,
authorization, persistence, scheduling, telemetry, notifications,
backup/restore, and outbound server connections.

Each configured server can use the official Palworld REST API and an optional
direct PalDefender REST connection. PalCenter selects the appropriate provider
for each supported capability while presenting one server administration
workspace to the user.

## Workspace boundaries

| Workspace         | Responsibility                                              |
| ----------------- | ----------------------------------------------------------- |
| `apps/frontend`   | Next.js/React presentation and browser interaction          |
| `apps/api`        | Fastify routes, services, provider clients, and persistence |
| `packages/ui`     | Shared presentation components                              |
| `packages/config` | Shared TypeScript and lint configuration                    |

The frontend never contacts a game server directly. Server credentials remain
in API-owned storage and are omitted or masked in public responses. Backups may
contain credentials and must be treated as sensitive.

## Server providers

- The official Palworld REST API supplies native status, settings, players,
  administration, and telemetry capabilities.
- PalDefender supplies its documented enhanced read and administration
  capabilities when configured for an individual server.
- Provider failures must not silently redirect write operations to an
  incompatible endpoint. Explicitly supported safe fallbacks are selected by
  the API service layer.

Connection records are stored in `servers.json`. On startup, the connection
repository validates each record and removes obsolete fields from discontinued
integrations. This keeps existing installations and restored backups readable
without exposing or continuing to store obsolete secrets.

Historical telemetry and world events live in `history.sqlite`; users and
password hashes live in `users.sqlite`. Existing historical event source values
remain readable even when the integration that originally produced them is no
longer available.

## Deployment

The production image runs the frontend and API without requiring access to
Palworld directories or the Docker socket. It requires outbound network access
to each configured official REST or PalDefender endpoint. Reverse-proxy
deployments should expose the web service over HTTPS and keep game-server APIs
on trusted networks whenever possible.
