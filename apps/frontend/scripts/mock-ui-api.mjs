import { createServer } from "node:http";

const now = "2026-07-29T22:30:00.000Z";

const user = {
  id: "usr-ui-test",
  username: "ui-review",
  email: "ui-review@localhost.invalid",
  role: "administrator",
  enabled: true,
  mustChangePassword: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: now,
  lastLoginAt: now,
};

const session = {
  authenticated: true,
  user,
  version: "1.4.0-DEV",
  application: {
    name: "PalCenter",
    description: "Palworld Server Command Center",
    version: "1.4.0-DEV",
    channel: "development",
    commit: "ui-test",
    deployment: "Docker",
  },
};

const connection = {
  id: "srv-test",
  name: "Palpagos Test Server",
  baseUrl: "http://palworld.example:8212",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: now,
  companion: {
    enabled: true,
    host: "companion.internal",
    port: 18213,
    tokenConfigured: true,
  },
};

const connectedPlayers = [
  {
    name: "Denalb",
    playerId: "0094A2FA000000000000000000000000",
    userId: "gdk_2533274899179326",
    ip: "192.0.2.10",
    status: "online",
  },
];

const telemetryPlayer = {
  id: 1,
  serverId: connection.id,
  userId: connectedPlayers[0].userId,
  playerId: connectedPlayers[0].playerId,
  playerName: connectedPlayers[0].name,
  accountName: "Denalb3032",
  capturedAt: now,
  x: 125000,
  y: -75000,
  z: null,
  level: 42,
  ping: 31,
  buildingCount: 4,
  guildId: null,
  guildName: null,
  coordinateSpaceId: "palpagos",
  createdAt: now,
};

let playerMode = "populated";
let eventMode = "populated";
let companionMode = "connected";
let sessionRole = "administrator";

const worldEvents = Array.from({ length: 55 }, (_, index) => {
  const joined = index % 2 === 0;
  const type =
    index <= 2
      ? "player_rapid_relocation"
      : index === 3
        ? "player_idle_started"
        : index === 4
          ? "player_afk_started"
          : joined
            ? "player_joined"
            : "session_started";
  return {
    id: `wie-ui-${String(index).padStart(3, "0")}`,
    serverId: connection.id,
    userId: connectedPlayers[0].userId,
    playerId: connectedPlayers[0].playerId,
    timestamp: new Date(Date.parse(now) - index * 60_000).toISOString(),
    type,
    metadata: {
      playerName: connectedPlayers[0].name,
      ...(index <= 2
        ? {
            classification:
              index === 0
                ? "unexplained_relocation"
                : index === 1
                  ? "likely_instance_transition"
                  : "likely_map_transition",
            ...(index > 0
              ? {
                  transitionDirection: "entry",
                  matchedTransitionSignatureId: `fixture-signature-${index}`,
                  matchedTransitionDisplayName:
                    index === 1 ? "Fixture Dungeon" : "Fixture Secondary Map",
                  transitionType: index === 1 ? "dungeon" : "secondary_map",
                }
              : {}),
            originTimestamp: new Date(
              Date.parse(now) - (index * 60_000 + 30_000),
            ).toISOString(),
            originCoordinateSpaceId: "palpagos",
            destinationCoordinateSpaceId:
              index === 0
                ? "palpagos"
                : index === 1
                  ? "instance:fixture-dungeon"
                  : "world_tree",
            originX: -120000,
            originY: 85000,
            destinationX: 210000,
            destinationY: -95000,
            elapsedSeconds: 30,
            ...(index === 0
              ? { displacement: 375000, impliedSpeed: 12500 }
              : {}),
          }
        : {
            note: index === 3 ? "Current roster observation" : "Retained event",
          }),
    },
    confidence: index <= 4 ? 0.9 : 1,
    evidence:
      index === 0
        ? [
            {
              source: "telemetry",
              fact: "rapid_displacement",
              value: "375000 world units in 30 seconds",
            },
            {
              source: "telemetry",
              fact: "implied_speed",
              value: "12500 world units per second",
            },
          ]
        : index <= 2
          ? [
              {
                source: "transition_registry",
                fact: "transition_signature_matched",
                value:
                  index === 1 ? "Fixture Dungeon" : "Fixture Secondary Map",
              },
              {
                source: "transition_registry",
                fact: "coordinate_space_changed",
                value:
                  index === 1
                    ? "palpagos to instance:fixture-dungeon"
                    : "palpagos to world_tree",
              },
            ]
          : index <= 4
            ? [
                {
                  source: "telemetry",
                  fact: "within_radius",
                  value: `300 world units for ${index === 3 ? 10 : 30} minutes`,
                },
                {
                  source: "players",
                  fact: "roster_present",
                  value: "online_roster",
                },
              ]
            : [
                {
                  source: "players",
                  fact: "appeared",
                  value: "online_roster",
                },
              ],
    position:
      index <= 2
        ? { x: 210000, y: -95000, z: null }
        : index === 3
          ? { x: telemetryPlayer.x, y: telemetryPlayer.y, z: null }
          : null,
  };
});

function json(response, value, status = 200) {
  response.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(value));
}

export function startMockUiApi(port = 3198) {
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);

    if (url.pathname === "/__test/players") {
      playerMode = url.searchParams.get("mode") ?? "populated";
      return json(response, { playerMode });
    }
    if (url.pathname === "/__test/events") {
      eventMode = url.searchParams.get("mode") ?? "populated";
      return json(response, { eventMode });
    }
    if (url.pathname === "/__test/role") {
      sessionRole = url.searchParams.get("role") ?? "administrator";
      return json(response, { sessionRole });
    }
    if (url.pathname === "/__test/companion") {
      companionMode = url.searchParams.get("mode") ?? "connected";
      return json(response, { companionMode });
    }

    if (url.pathname === "/api/auth/session") {
      return json(response, {
        ...session,
        user: { ...session.user, role: sessionRole },
      });
    }
    if (url.pathname === "/api/auth/setup-status") {
      return json(response, { setupRequired: false });
    }
    if (url.pathname === "/api/users/me") return json(response, user);
    if (url.pathname === "/api/servers") {
      return json(response, { servers: [connection] });
    }
    if (url.pathname === `/api/servers/${connection.id}`) {
      return json(response, {
        connection,
        status: {
          id: connection.id,
          name: connection.name,
          status: "online",
          serverName: "Palpagos Dedicated Server",
          players: playerMode === "empty" ? 0 : connectedPlayers.length,
          maxPlayers: 32,
          fps: 60,
          version: "v0.6.5.81234",
          responseTimeMs: 42,
          uptimeSeconds: 86400,
          passwordProtected: false,
          lastUpdated: now,
        },
        configuration: {
          restUrl: connection.baseUrl,
          publicIp: "203.0.113.10",
          publicPort: 8211,
          restPort: 8212,
          rconEnabled: true,
          rconPort: 25575,
          region: "North America",
          crossplayPlatforms: "Steam, Xbox",
        },
      });
    }
    if (url.pathname.startsWith(`/api/servers/${connection.id}/companion`)) {
      if (companionMode !== "connected") {
        return json(response, {
          state:
            companionMode === "disconnected" ? "unreachable" : companionMode,
          checkedAt: now,
          health: null,
          version: null,
          capabilities: {},
        });
      }
      return json(response, {
        state: "connected",
        checkedAt: now,
        reason: null,
        health: "healthy",
        version: {
          applicationVersion: "0.1.0",
          apiVersion: "v1",
          buildCommit: "abc1234",
          buildBranch: "main",
          buildDate: now,
          compiler: "C++20",
          palworldVersion: "v1.0.2.101103",
          ue4ssVersion: null,
          compatibility: {},
          runtime: {
            startedAt: now,
            uptimeSeconds: 7200,
            instanceId: "fixture",
            checks: { configuration: "healthy", httpListener: "healthy" },
          },
        },
        capabilities: {
          health: { supported: true, capabilityVersion: "1" },
          version: { supported: true, capabilityVersion: "1" },
          futureCapability: { supported: false, capabilityVersion: "1" },
        },
      });
    }
    if (url.pathname === `/api/servers/${connection.id}/players`) {
      if (playerMode === "error") {
        return json(
          response,
          { error: "palworld_unavailable", message: "fetch failed" },
          503,
        );
      }
      return json(response, {
        players: playerMode === "empty" ? [] : connectedPlayers,
      });
    }
    if (
      url.pathname === `/api/servers/${connection.id}/telemetry/players/latest`
    ) {
      if (playerMode === "error") {
        return json(
          response,
          { error: "telemetry_unavailable", message: "database unavailable" },
          503,
        );
      }
      const currentTelemetry =
        playerMode === "instance"
          ? {
              ...telemetryPlayer,
              x: 12345,
              y: 67890,
              coordinateSpaceId: "instance:fixture-dungeon",
            }
          : playerMode === "world-tree"
            ? {
                ...telemetryPlayer,
                x: -42000,
                y: 91000,
                coordinateSpaceId: "world_tree",
              }
            : playerMode === "stale"
              ? {
                  ...telemetryPlayer,
                  capturedAt: "2026-07-29T20:00:00.000Z",
                }
              : telemetryPlayer;
      return json(response, {
        players: playerMode === "empty" ? [] : [currentTelemetry],
        trustedPositions: playerMode === "empty" ? [] : [telemetryPlayer],
        pollingIntervalSeconds: 30,
        lastCollectedAt:
          playerMode === "stale" ? currentTelemetry.capturedAt : now,
      });
    }
    if (
      url.pathname ===
      `/api/servers/${connection.id}/telemetry/players/${connectedPlayers[0].userId}/history`
    ) {
      return json(response, {
        points: [
          {
            capturedAt: "2026-07-29T22:10:00.000Z",
            x: 85000,
            y: -110000,
            coordinateSpaceId: "palpagos",
          },
          {
            capturedAt: "2026-07-29T22:14:00.000Z",
            x: 93000,
            y: -103000,
            coordinateSpaceId: "palpagos",
          },
          {
            capturedAt: "2026-07-29T22:18:00.000Z",
            x: 102000,
            y: -95000,
            coordinateSpaceId: "palpagos",
          },
          {
            capturedAt: "2026-07-29T22:22:00.000Z",
            x: 111000,
            y: -87000,
            coordinateSpaceId: "palpagos",
          },
          {
            capturedAt: "2026-07-29T22:26:00.000Z",
            x: 119000,
            y: -80000,
            coordinateSpaceId: "palpagos",
          },
          {
            capturedAt: now,
            x: telemetryPlayer.x,
            y: telemetryPlayer.y,
            coordinateSpaceId: "palpagos",
          },
        ],
        limit: 5000,
        truncated: false,
      });
    }
    if (url.pathname === `/api/servers/${connection.id}/world-events`) {
      if (eventMode === "error") {
        return json(
          response,
          { error: "events_unavailable", message: "database unavailable" },
          503,
        );
      }
      if (eventMode === "empty") return json(response, { events: [] });
      const userId = url.searchParams.get("userId");
      const type = url.searchParams.get("type");
      const to = url.searchParams.get("to");
      const limit = Number(url.searchParams.get("limit") ?? 50);
      const filtered = worldEvents.filter(
        (event) =>
          (!userId || event.userId === userId) &&
          (!type || event.type === type) &&
          (!to || event.timestamp <= to),
      );
      return json(response, {
        events: filtered.slice(0, limit).reverse(),
      });
    }
    if (url.pathname === "/api/backup/info") {
      return json(response, {
        applicationVersion: "1.4.0-DEV",
        backupFormatVersion: 3,
        compatibleFormatVersions: [1, 2, 3],
        data: {
          servers: { available: true, sizeBytes: 2048 },
          notifications: { available: true, sizeBytes: 1024 },
          history: { available: true, sizeBytes: 65536 },
          users: { available: true, sizeBytes: 4096 },
        },
      });
    }
    if (url.pathname === "/api/automations") {
      return json(response, { tasks: [] });
    }
    if (url.pathname === "/api/automations/summary") {
      return json(response, {
        activeTasks: 1,
        disabledTasks: 0,
        failedToday: 0,
        nextScheduledRun: "2026-12-31T23:59:59.000Z",
      });
    }

    return json(
      response,
      { error: "mock_not_found", message: `No UI fixture for ${url.pathname}` },
      404,
    );
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}
