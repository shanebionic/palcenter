import { createServer } from "node:http";
import { Buffer } from "node:buffer";

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

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
  palDefender: {
    enabled: false,
    endpoint: null,
    tokenConfigured: false,
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

const baseServerStatus = {
  id: connection.id,
  name: connection.name,
  status: "online",
  serverName: "Palpagos Dedicated Server",
  players: 1,
  maxPlayers: 32,
  fps: 60,
  version: "v0.6.5.81234",
  responseTimeMs: 42,
  uptimeSeconds: 86400,
  passwordProtected: false,
  lastUpdated: now,
};

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
let palDefenderMode = "disabled";
let sessionRole = "administrator";
let broadcasts = [];
let moderationIpBanned = true;
let progressionExperience = 1371;
let unlockedTechnologies = ["Arrow"];
let grantedPals = [];
let serverStatusMode = "populated";
let addedServers = [];

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
  const server = createServer(async (request, response) => {
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
    if (url.pathname === "/__test/paldefender") {
      palDefenderMode = url.searchParams.get("mode") ?? "disabled";
      return json(response, { mode: palDefenderMode });
    }
    if (url.pathname === "/__test/broadcasts") {
      if (url.searchParams.get("reset") === "true") broadcasts = [];
      return json(response, { broadcasts });
    }
    if (url.pathname === "/__test/servers") {
      if (url.searchParams.get("reset") === "true") addedServers = [];
      serverStatusMode = url.searchParams.get("mode") ?? "populated";
      return json(response, { serverStatusMode });
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
    if (request.method === "POST" && url.pathname === "/api/servers/test") {
      return json(response, {
        info: {
          servername: "Mock Palworld Server",
          version: "v0.6.5.81234",
        },
        metrics: {
          currentplayernum: 1,
          maxplayernum: 32,
          serverfps: 60,
        },
        latencyMs: 42,
      });
    }
    if (request.method === "POST" && url.pathname === "/api/servers") {
      const input = await readJson(request);
      const created = {
        id: `srv-added-${addedServers.length + 1}`,
        name: input.name,
        baseUrl: input.baseUrl,
        createdAt: now,
        updatedAt: now,
        palDefender: {
          enabled: false,
          endpoint: null,
          tokenConfigured: false,
        },
      };
      addedServers.push({
        ...baseServerStatus,
        id: created.id,
        name: created.name,
        serverName: "Mock Palworld Server",
      });
      return json(response, created);
    }
    if (url.pathname === "/api/servers") {
      return json(response, { servers: [connection] });
    }
    if (url.pathname === "/api/servers/status") {
      const servers =
        serverStatusMode === "empty"
          ? [...addedServers]
          : [baseServerStatus, ...addedServers];
      return json(response, { servers });
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
    if (
      request.method === "POST" &&
      url.pathname === `/api/servers/${connection.id}/admin/announce`
    ) {
      const provider =
        palDefenderMode === "connected" ? "paldefender" : "native";
      broadcasts.push({ serverId: connection.id, provider });
      return json(response, {
        success: true,
        message: "Announcement sent.",
        provider,
      });
    }
    const moderationPath = `/api/servers/${connection.id}/moderation`;
    const actor = {
      type: "rest",
      name: "PalCenter",
      ip: "192.0.2.1",
      reason: "Controlled test",
      timestamp: "2026-08-08T20:00:00.000Z",
    };
    if (request.method === "GET" && url.pathname === moderationPath) {
      if (palDefenderMode !== "connected")
        return json(
          response,
          {
            error:
              palDefenderMode === "disabled"
                ? "paldefender_disabled"
                : "paldefender_unavailable",
            message:
              palDefenderMode === "disabled"
                ? "PalDefender is not enabled for this server."
                : "Unable to reach PalDefender.",
          },
          palDefenderMode === "disabled" ? 409 : 502,
        );
      return json(response, {
        version: 1,
        bannedMessage: "You are banned.",
        userBans: [
          {
            userId: "steam_76561198000000001",
            active: true,
            bannedBy: actor,
            unbannedBy: null,
          },
        ],
        ipBans: moderationIpBanned
          ? [
              {
                ip: "192.0.2.10",
                active: true,
                bannedBy: actor,
                unbannedBy: null,
              },
            ]
          : [],
      });
    }
    if (
      request.method === "POST" &&
      url.pathname === `${moderationPath}/users/steam_76561198000000001/unban`
    )
      return json(response, {
        success: true,
        target: "steam_76561198000000001",
      });
    if (
      request.method === "POST" &&
      url.pathname === `${moderationPath}/ip/unban`
    ) {
      moderationIpBanned = false;
      return json(response, { success: true, target: "192.0.2.10" });
    }
    if (
      request.method === "POST" &&
      url.pathname === `${moderationPath}/ip/ban`
    ) {
      moderationIpBanned = true;
      return json(response, {
        success: true,
        target: "192.0.2.10",
        kickedPlayers: 0,
      });
    }
    if (
      request.method === "POST" &&
      url.pathname === `/api/servers/${connection.id}/admin/save`
    ) {
      return json(response, { success: true, message: "World saved." });
    }
    if (
      request.method === "POST" &&
      url.pathname === `/api/servers/${connection.id}/admin/shutdown`
    ) {
      return json(response, {
        success: true,
        message: "Server shutdown scheduled.",
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
    if (url.pathname === `/api/servers/${connection.id}/paldefender/status`) {
      const connected = palDefenderMode === "connected";
      const enabled = palDefenderMode !== "disabled";
      return json(response, {
        state: connected ? "connected" : enabled ? palDefenderMode : "disabled",
        enabled,
        configured: enabled,
        connected,
        version: connected ? "1.8.3" : "Unavailable",
        responseTime: connected ? 4 : 0,
      });
    }
    if (url.pathname === `/api/servers/${connection.id}/paldefender/players`) {
      return json(response, {
        players: [
          {
            name: "Denalb",
            playerId: "0094A2FA-00000000-00000000-00000000",
            online: true,
            guild: "Pal Tamers",
            level: 42,
          },
        ],
      });
    }
    const enhancedPlayerPath = `/api/servers/${connection.id}/paldefender/players/0094A2FA-00000000-00000000-00000000`;
    if (url.pathname === enhancedPlayerPath) {
      return json(response, {
        name: "Denalb",
        playerId: "0094A2FA-00000000-00000000-00000000",
        online: true,
        guild: "Pal Tamers",
        level: 42,
        worldLocation: null,
        mapLocation: null,
      });
    }
    if (
      url.pathname === `${enhancedPlayerPath}/items` &&
      request.method === "POST"
    ) {
      const input = await readJson(request);
      if (input.items?.[0]?.itemId !== "PalSphere_Ultimate") {
        return json(response, { message: "Expected catalog ItemID" }, 422);
      }
      return json(response, {
        playerId: "0094A2FA-00000000-00000000-00000000",
        grantedItems: 1,
      });
    }
    if (url.pathname === `${enhancedPlayerPath}/inventory`) {
      return json(response, {
        items: [
          { container: "Inventory", slot: 0, itemId: "Wood", quantity: 5 },
        ],
      });
    }
    if (url.pathname === `${enhancedPlayerPath}/pals`) {
      if (request.method === "POST") {
        const input = await readJson(request);
        if (input.pals?.[0]?.palId !== "SheepBall") {
          return json(response, { message: "Expected catalog PalID" }, 422);
        }
        grantedPals.push({
          instanceId: "given-pal",
          location: "Palbox",
          baseCampId: null,
          palId: input.pals[0].palId,
          nickname: null,
          level: 1,
          experience: null,
          gender: null,
          rank: null,
          shiny: null,
          condensedPals: null,
          partnerSkillLevel: null,
          physicalHealth: null,
          workerSick: null,
          imported: null,
          hp: null,
          hunger: null,
          maxHunger: null,
          sanity: null,
          support: null,
          craftSpeed: null,
          palSouls: {},
          ivs: {},
          extraWorkSuitabilities: {},
          disabledWorkPreferences: [],
          passiveSkills: [],
          activeSkills: [],
          learnedSkills: [],
        });
        return json(response, {
          playerId: "0094A2FA-00000000-00000000-00000000",
          grantedPals: 1,
        });
      }
      return json(response, { pals: grantedPals });
    }
    if (url.pathname === `${enhancedPlayerPath}/pal-templates`) {
      grantedPals.push({
        instanceId: "template-pal",
        location: "Palbox",
        baseCampId: null,
        palId: "Pengullet",
        nickname: "Template Pal",
        level: 1,
        experience: null,
        gender: null,
        rank: null,
        shiny: null,
        condensedPals: null,
        partnerSkillLevel: null,
        physicalHealth: null,
        workerSick: null,
        imported: null,
        hp: null,
        hunger: null,
        maxHunger: null,
        sanity: null,
        support: null,
        craftSpeed: null,
        palSouls: {},
        ivs: {},
        extraWorkSuitabilities: {},
        disabledWorkPreferences: [],
        passiveSkills: [],
        activeSkills: [],
        learnedSkills: [],
      });
      return json(response, {
        playerId: "0094A2FA-00000000-00000000-00000000",
        grantedPalTemplates: 1,
      });
    }
    if (url.pathname === `${enhancedPlayerPath}/pal-eggs`) {
      const input = await readJson(request);
      if (
        input.palEggs?.[0]?.eggId !== "PalEgg_Normal_01" ||
        input.palEggs?.[0]?.palId !== "Kitsunebi"
      ) {
        return json(response, { message: "Expected catalog egg IDs" }, 422);
      }
      return json(response, {
        playerId: "0094A2FA-00000000-00000000-00000000",
        grantedPalEggs: 1,
      });
    }
    if (url.pathname === `${enhancedPlayerPath}/technology`) {
      return json(response, { technologies: unlockedTechnologies });
    }
    if (
      url.pathname === `${enhancedPlayerPath}/technology/learn` &&
      request.method === "POST"
    ) {
      const input = await readJson(request);
      const requested =
        input.scope === "all"
          ? ["Technology_Wood", "Technology_Camp", "Technology_ElecBaton"]
          : input.technologyIds;
      if (input.scope === "selected" && !requested.includes("Workbench")) {
        return json(response, { message: "Expected catalog TechID" }, 422);
      }
      const changed = requested.filter(
        (id) => !unlockedTechnologies.includes(id),
      );
      const skipped = requested.filter((id) =>
        unlockedTechnologies.includes(id),
      );
      unlockedTechnologies = [
        ...new Set([...unlockedTechnologies, ...requested]),
      ];
      return json(response, { changedCount: changed.length, changed, skipped });
    }
    if (
      url.pathname === `${enhancedPlayerPath}/technology/forget` &&
      request.method === "POST"
    ) {
      const input = await readJson(request);
      const requested =
        input.scope === "all" ? [...unlockedTechnologies] : input.technologyIds;
      const changed = requested.filter((id) =>
        unlockedTechnologies.includes(id),
      );
      const skipped = requested.filter(
        (id) => !unlockedTechnologies.includes(id),
      );
      unlockedTechnologies = unlockedTechnologies.filter(
        (id) => !requested.includes(id),
      );
      return json(response, {
        changedCount: changed.length,
        changed: input.scope === "all" ? "All" : changed,
        skipped,
      });
    }
    if (url.pathname === `${enhancedPlayerPath}/progression`) {
      if (request.method === "POST") {
        progressionExperience += 10;
        return json(response, {
          playerId: "0094A2FA-00000000-00000000-00000000",
          grant: { type: "experience", amount: 10 },
          totals: {
            technologyPoints: null,
            ancientTechnologyPoints: null,
            relics: {},
          },
        });
      }
      return json(response, {
        playerId: "0094A2FA-00000000-00000000-00000000",
        requestedPlayerId: "0094A2FA-00000000-00000000-00000000",
        character: {
          level: 6,
          experience: progressionExperience,
          unusedStatusPoints: 5,
        },
        currencies: {
          relics: {},
          technologyPoints: 5,
          ancientTechnologyPoints: 0,
        },
        bosses: {
          towerDefeats: {},
          normalDefeatFlags: {},
          raidDefeats: {},
          totalDefeats: 0,
          predatorDefeats: 0,
        },
        captures: {
          total: 9,
          byPal: { Anubis: 1 },
          bonusesByPal: { Anubis: 1 },
          butcheredByPal: {},
        },
        activities: {
          craftedItems: { Wood: 3 },
          normalDungeonsCleared: 0,
          fixedDungeonsCleared: 0,
          oilRigsCleared: 0,
          palRankUps: {},
          soloArenasCleared: {},
          npcTalks: {},
          fishing: {},
          treasuresFound: 0,
          campsConquered: 0,
          firstFishingCompleted: false,
        },
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
      const liveTelemetry = {
        ...telemetryPlayer,
        capturedAt: new Date().toISOString(),
      };
      const currentTelemetry =
        playerMode === "instance"
          ? {
              ...liveTelemetry,
              x: 12345,
              y: 67890,
              coordinateSpaceId: "instance:fixture-dungeon",
            }
          : playerMode === "world-tree"
            ? {
                ...liveTelemetry,
                x: 518250,
                y: -647298.5,
                coordinateSpaceId: "world_tree",
              }
            : playerMode === "unknown"
              ? { ...liveTelemetry, coordinateSpaceId: "unknown" }
              : playerMode === "stale"
                ? {
                    ...telemetryPlayer,
                    capturedAt: "2026-07-29T20:00:00.000Z",
                  }
                : liveTelemetry;
      return json(response, {
        players: playerMode === "empty" ? [] : [currentTelemetry],
        trustedPositions: playerMode === "empty" ? [] : [telemetryPlayer],
        coordinateSpacesAuthoritative: false,
        pollingIntervalSeconds: 30,
        lastCollectedAt: currentTelemetry.capturedAt,
      });
    }
    if (
      url.pathname ===
      `/api/servers/${connection.id}/telemetry/players/${connectedPlayers[0].userId}/history`
    ) {
      const historyNow = Date.now();
      return json(response, {
        points: [
          {
            capturedAt: new Date(historyNow - 10 * 60_000).toISOString(),
            x: 85000,
            y: -110000,
            coordinateSpaceId:
              playerMode === "unknown" ? "unknown" : "palpagos",
          },
          {
            capturedAt: new Date(historyNow - 8 * 60_000).toISOString(),
            x: 93000,
            y: -103000,
            coordinateSpaceId:
              playerMode === "unknown" ? "unknown" : "palpagos",
          },
          {
            capturedAt: new Date(historyNow - 6 * 60_000).toISOString(),
            x: 102000,
            y: -95000,
            coordinateSpaceId:
              playerMode === "unknown" ? "unknown" : "palpagos",
          },
          {
            capturedAt: new Date(historyNow - 4 * 60_000).toISOString(),
            x: 111000,
            y: -87000,
            coordinateSpaceId:
              playerMode === "unknown" ? "unknown" : "palpagos",
          },
          {
            capturedAt: new Date(historyNow - 2 * 60_000).toISOString(),
            x: 119000,
            y: -80000,
            coordinateSpaceId:
              playerMode === "unknown" ? "unknown" : "palpagos",
          },
          {
            capturedAt: new Date(historyNow).toISOString(),
            x: telemetryPlayer.x,
            y: telemetryPlayer.y,
            coordinateSpaceId:
              playerMode === "unknown" ? "unknown" : "palpagos",
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
