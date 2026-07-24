# PalCenter Security

## Reporting a vulnerability

Do not open a public issue containing credentials, backups, or exploit details.
Contact the repository owner privately and include the affected version,
reproduction steps, and impact without attaching production data.

## v1.0 security model

PalCenter uses SQLite-backed accounts, memory-hard scrypt password hashes,
signed HttpOnly SameSite cookies, session expiration and version invalidation,
login throttling, origin/CSRF checks, strict API schemas, and backend-enforced
Administrator, Moderator, and Visitor permissions.

On first start, PalCenter generates a 384-bit session secret with the operating
system cryptographic random source. It stores the secret only in
`/app/data/system.json`, with owner-only permissions. The value is never
returned by an API or frontend bundle. Existing installations may provide
`PALCENTER_SESSION_SECRET` once: it is copied into a missing `system.json`, and
stored configuration wins on every later start.

Credentials in `servers.json`, `notifications.json`, `users.sqlite`, and
`system.json` are redacted from API responses and known log fields. All of
these files, `history.sqlite`, and backup archives are sensitive and should be
protected by host access controls and encrypted backup storage.

The container runs as an unprivileged user. Compose drops Linux capabilities,
enables `no-new-privileges`, and mounts only `/app/data`; PalCenter neither
needs nor should receive the Docker socket or Palworld save directories.

## Deployment recommendations

- Run a pinned release image behind HTTPS and set
  `PALCENTER_SESSION_COOKIE_SECURE=true`.
- Restrict both exposed ports to a trusted management network. Prefer the
  frontend's same-origin API proxy and leave `PALCENTER_CORS_ORIGINS` empty.
- Protect the Docker host and volume, use unique credentials, retain encrypted
  tested backups, and review container logs.
- Back up the complete volume while stopped, or use the authenticated Backup
  page. Never copy a live SQLite file by itself.
- Review users regularly and disable accounts that no longer need access.

## v1.0 audit findings and residual risks

The final audit verified setup is single-use, passwords are never stored in
plaintext, session cookies and expiration are enforced, role checks occur in
the API, the last enabled Administrator is protected, restore is
Administrator-only and validated before replacement, and known sensitive
fields are redacted from logs. Secret generation, persisted migration,
backup-format v3 validation, file permissions, and container privilege
reduction were added as audit remediations.

Known v1.0 limitations:

- There is no MFA, external identity provider, or per-user audit trail.
- Data and portable backups are not application-encrypted at rest; storage
  encryption and access control are operator responsibilities.
- Login throttling is in memory and resets when the API restarts.
- Palworld REST traffic is only as secure as the configured remote URL; use a
  trusted network or TLS-capable endpoint.
- Directly publishing the API port increases attack surface even though it
  remains authenticated.

Security-relevant administrator activity is represented by current server
events and application logs, but a tamper-resistant authentication and
configuration audit log is intentionally deferred beyond v1.0.
