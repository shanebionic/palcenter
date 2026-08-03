# PalCenter Companion

PalCenter Companion is optional. PalCenter continues to manage servers through the official Palworld REST API when it is absent.

For each configured server, PalCenter inherits the REST API host and uses port `8213` by default. **Advanced Companion Connection** supports explicit host and port overrides for Docker, Unraid, private networks, reverse proxies, and multiple servers sharing an address.

The Companion creates `PalCenterCompanion/config/PalCenterCompanion.token` on first startup. Copy that value into PalCenter's masked **Companion API token** field. It is stored with the existing server credentials, included in authenticated backups, never returned by the API, and preserved when the edit field is left blank.

PalCenter probes the public health endpoint first. When a token is configured, it sends `Authorization: Bearer <token>` to the version, capability, and bounded Activity endpoints. Discovery results are cached for 30 seconds when requested. **Refresh** bypasses the discovery cache.

The Connection Settings page shows whether the Companion is connected, its reported versions and build, uptime, health, and supported capabilities. Timeouts, invalid JSON, older flat capability documents, future fields, and unknown capabilities do not interrupt normal server management.

Capabilities—not application version numbers—control future feature availability. Capability identifiers are permanent and additive. PalCenter ignores unknown metadata and treats missing or malformed entries as unsupported.

The player map continues using standard Palworld REST coordinates while exact
Companion location support is unavailable. Dungeons, towers, and the World Tree
may appear in the wrong place during this fallback. A future additive
`coordinateSpaces` capability can enable exact map-area handling only after the
Companion also supplies authoritative position data.

When `playerActivity` is supported, PalCenter uses the Companion’s exact join,
leave, and online-session records in the existing **Activity** timeline. A
completed session includes how long the player was online. Stable Companion
event IDs prevent duplicate history. If a matching standard `/players`
observation exists within 60 seconds, the exact Companion record wins. If the
Companion is missing, disconnected, or does not support this capability,
PalCenter continues showing activity inferred from standard server information.
The Activity page identifies this fallback in plain language.

The Companion Activity buffer is bounded and memory-only. Restarting PalServer
starts a new buffer; PalCenter keeps history it already received and continues
from new records without trying to reconstruct the gap.

If PalCenter and Palworld run in separate containers, bind the Companion to the Palworld container's private interface, publish/map port `8213` when needed, and use the container hostname in PalCenter. For remote hosts, allow the configured private address through the firewall. Bearer tokens do not encrypt traffic: use trusted private networking or a TLS reverse proxy and do not expose Companion directly to the public Internet.
