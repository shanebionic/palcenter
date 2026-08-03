# PalCenter Companion

PalCenter Companion is optional. PalCenter continues to manage servers through the official Palworld REST API when it is absent.

For each configured server, PalCenter derives the Companion address from the REST API host and probes port `8213`. It reads health first, then version and capabilities. Results are cached briefly and refreshed through the normal UI or the manual **Refresh** action.

The Connection Settings page shows whether the Companion is connected, its reported versions and build, uptime, health, and supported capabilities. Timeouts, invalid JSON, older flat capability documents, future fields, and unknown capabilities do not interrupt normal server management.

Capabilities—not application version numbers—control future feature availability. Capability identifiers are permanent and additive. PalCenter ignores unknown metadata and treats missing or malformed entries as unsupported.

If PalCenter and Palworld run in separate containers, configure the Companion listener and port so PalCenter can reach the Palworld container on port `8213`. Do not expose the unauthenticated discovery listener directly to the public Internet.
