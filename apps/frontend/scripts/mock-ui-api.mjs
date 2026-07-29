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
  createdAt: now,
};

let playerMode = "populated";

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

    if (url.pathname === "/api/auth/session") return json(response, session);
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
    if (url.pathname === `/api/servers/${connection.id}/players`) {
      return json(response, {
        players: playerMode === "empty" ? [] : connectedPlayers,
      });
    }
    if (
      url.pathname === `/api/servers/${connection.id}/telemetry/players/latest`
    ) {
      return json(response, {
        players: playerMode === "empty" ? [] : [telemetryPlayer],
        pollingIntervalSeconds: 30,
        lastCollectedAt: now,
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
