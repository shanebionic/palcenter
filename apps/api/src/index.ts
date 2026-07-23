import cors from "@fastify/cors";
import Fastify from "fastify";
import { z } from "zod";
import { PalworldRestError } from "./clients/palworld-rest-client.js";
import { NotificationDeliveryError } from "./providers/notification-provider.js";
import { JsonConnectionRepository } from "./repositories/json-connection-repository.js";
import { JsonNotificationRepository } from "./repositories/json-notification-repository.js";
import { SqliteHistoryRepository } from "./repositories/sqlite-history-repository.js";
import { ConnectionManager } from "./services/connection-manager.js";
import {
  NotificationConfigurationError,
  NotificationNotFoundError,
  NotificationService,
} from "./services/notification-service.js";
import {
  PlayerServerNotFoundError,
  PlayerService,
} from "./services/player-service.js";
import {
  ServerAdminService,
  ServerNotFoundError,
} from "./services/server-admin-service.js";
import {
  HistoryServerNotFoundError,
  ServerHistoryService,
} from "./services/server-history-service.js";
import {
  ServerSettingsService,
  SettingsServerNotFoundError,
} from "./services/server-settings-service.js";
import { ServerStatusService } from "./services/server-status-service.js";
import { notificationEventTypes } from "./types/notifications.js";

const environmentSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  CONFIG_DIR: z.string().min(1).default("./data"),
  HISTORY_INTERVAL_SECONDS: z.coerce.number().int().min(5).default(30),
});

const environment = environmentSchema.parse(process.env);

const app = Fastify({
  logger: true,
});

await app.register(cors, {
  origin: true,
});

const repository = new JsonConnectionRepository(environment.CONFIG_DIR);
const historyRepository = new SqliteHistoryRepository(environment.CONFIG_DIR);
const notificationRepository = new JsonNotificationRepository(
  environment.CONFIG_DIR,
);
const connectionManager = new ConnectionManager(repository);
const notificationService = new NotificationService(
  notificationRepository,
  repository,
  ({ providerId, providerName, error }) => {
    app.log.error(
      { err: error, providerId, providerName },
      "Notification delivery failed.",
    );
  },
);
const playerService = new PlayerService(
  repository,
  async (serverId, playerId, playerName) => {
    const event = historyRepository.appendEvent({
      serverId,
      type: "player_banned",
      playerId,
      playerName,
      occurredAt: new Date().toISOString(),
    });
    await notificationService.handle([event]);
    return event;
  },
);
const serverAdminService = new ServerAdminService(repository);
const serverSettingsService = new ServerSettingsService(repository);
const serverStatusService = new ServerStatusService(repository);
const serverHistoryService = new ServerHistoryService(
  repository,
  historyRepository,
  serverStatusService,
  playerService,
  environment.HISTORY_INTERVAL_SECONDS * 1_000,
  (events) => notificationService.handle(events),
);

await connectionManager.initialize();
await notificationRepository.initialize();
historyRepository.initialize();
serverHistoryService.start((error) => {
  app.log.error(error, "Historical metric collection failed.");
});

app.addHook("onClose", async () => {
  serverHistoryService.stop();
});

app.get("/api/health", async () => ({
  status: "ok",
  application: "PalCenter",
  version: "0.1.0",
}));

app.get("/api/servers", async () => ({
  servers: await connectionManager.list(),
}));

app.get("/api/servers/status", async () => ({
  servers: await serverStatusService.list(),
}));

app.get("/api/servers/:id", async (request, reply) => {
  const parameters = z
    .object({
      id: z.string().min(1),
    })
    .parse(request.params);
  const server = await serverStatusService.get(parameters.id);

  if (!server) {
    return reply.code(404).send({
      error: "server_not_found",
      message: "The requested server does not exist.",
    });
  }

  return server;
});

const connectionInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  baseUrl: z.string().url(),
  adminPassword: z.string().min(1),
});

app.post("/api/servers/test", async (request) => {
  const input = connectionInputSchema.omit({ name: true }).parse(request.body);

  return connectionManager.test(input.baseUrl, input.adminPassword);
});

app.post("/api/servers", async (request, reply) => {
  const input = connectionInputSchema.parse(request.body);
  const connection = await connectionManager.add(input);

  return reply.code(201).send(connection);
});

app.delete("/api/servers/:id", async (request, reply) => {
  const parameters = z
    .object({
      id: z.string().min(1),
    })
    .parse(request.params);

  await connectionManager.delete(parameters.id);

  return reply.code(204).send();
});

const serverIdSchema = z.object({
  id: z.string().min(1),
});

const messageSchema = z.string().trim().min(1).max(500);

app.post("/api/servers/:id/admin/announce", async (request) => {
  const parameters = serverIdSchema.parse(request.params);
  const input = z.object({ message: messageSchema }).parse(request.body);

  await serverAdminService.announce(parameters.id, input.message);

  return {
    success: true,
    message: "Announcement sent.",
  };
});

app.post("/api/servers/:id/admin/save", async (request) => {
  const parameters = serverIdSchema.parse(request.params);

  await serverAdminService.saveWorld(parameters.id);

  return {
    success: true,
    message: "World saved.",
  };
});

app.post("/api/servers/:id/admin/shutdown", async (request) => {
  const parameters = serverIdSchema.parse(request.params);
  const input = z
    .object({
      waitTime: z.number().int().min(0).max(86_400),
      message: z.string().trim().max(500).optional(),
    })
    .parse(request.body);

  await serverAdminService.shutdown(
    parameters.id,
    input.waitTime,
    input.message || undefined,
  );

  return {
    success: true,
    message: "Server shutdown scheduled.",
  };
});

app.post("/api/servers/:id/admin/stop", async (request) => {
  const parameters = serverIdSchema.parse(request.params);

  await serverAdminService.stop(parameters.id);

  return {
    success: true,
    message: "Server force stop requested.",
  };
});

const playerParametersSchema = z.object({
  id: z.string().min(1),
  playerId: z.string().min(1),
});

app.get("/api/servers/:id/players", async (request) => {
  const parameters = serverIdSchema.parse(request.params);

  return {
    players: await playerService.list(parameters.id),
  };
});

app.post("/api/servers/:id/players/:playerId/kick", async (request) => {
  const parameters = playerParametersSchema.parse(request.params);

  await playerService.kick(parameters.id, parameters.playerId);

  return {
    success: true,
    message: "Player kicked.",
  };
});

app.post("/api/servers/:id/players/:playerId/ban", async (request) => {
  const parameters = playerParametersSchema.parse(request.params);

  await playerService.ban(parameters.id, parameters.playerId);

  return {
    success: true,
    message: "Player banned.",
  };
});

app.post("/api/servers/:id/players/:playerId/unban", async (request) => {
  const parameters = playerParametersSchema.parse(request.params);

  await playerService.unban(parameters.id, parameters.playerId);

  return {
    success: true,
    message: "Player unbanned.",
  };
});

app.get("/api/servers/:id/settings", async (request) => {
  const parameters = serverIdSchema.parse(request.params);

  return serverSettingsService.get(parameters.id);
});

const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

app.get("/api/servers/:id/history", async (request) => {
  const parameters = serverIdSchema.parse(request.params);
  const query = historyQuerySchema.parse(request.query);

  return {
    metrics: await serverHistoryService.metrics(parameters.id, query.limit),
  };
});

app.get("/api/servers/:id/events", async (request) => {
  const parameters = serverIdSchema.parse(request.params);
  const query = historyQuerySchema.parse(request.query);

  return {
    events: await serverHistoryService.events(parameters.id, query.limit),
  };
});

const notificationIdSchema = z.object({
  id: z.string().min(1),
});
const notificationEventsSchema = z.array(z.enum(notificationEventTypes)).min(1);
const httpUrlSchema = z
  .string()
  .url()
  .refine((value) => ["http:", "https:"].includes(new URL(value).protocol), {
    message: "Only HTTP and HTTPS URLs are supported.",
  });
const notificationBaseSchema = z.object({
  name: z.string().trim().min(1).max(80),
  enabled: z.boolean(),
  events: notificationEventsSchema,
});
const discordNotificationSchema = notificationBaseSchema.extend({
  type: z.literal("discord"),
  webhookUrl: httpUrlSchema,
});
const ntfyNotificationSchema = notificationBaseSchema.extend({
  type: z.literal("ntfy"),
  serverUrl: httpUrlSchema,
  topic: z.string().trim().min(1).max(200),
});
const notificationInputSchema = z.discriminatedUnion("type", [
  discordNotificationSchema,
  ntfyNotificationSchema,
]);
const notificationUpdateSchema = z.discriminatedUnion("type", [
  discordNotificationSchema.extend({
    webhookUrl: httpUrlSchema.optional(),
  }),
  ntfyNotificationSchema,
]);

app.get("/api/notifications", async () => ({
  providers: await notificationService.list(),
}));

app.post("/api/notifications", async (request, reply) => {
  const input = notificationInputSchema.parse(request.body);
  return reply.code(201).send(await notificationService.create(input));
});

app.put("/api/notifications/:id", async (request) => {
  const parameters = notificationIdSchema.parse(request.params);
  const input = notificationUpdateSchema.parse(request.body);
  return notificationService.update(parameters.id, input);
});

app.delete("/api/notifications/:id", async (request, reply) => {
  const parameters = notificationIdSchema.parse(request.params);
  await notificationService.delete(parameters.id);
  return reply.code(204).send();
});

app.post("/api/notifications/:id/test", async (request) => {
  const parameters = notificationIdSchema.parse(request.params);
  await notificationService.test(parameters.id);
  return {
    success: true,
    message: "Test notification sent.",
  };
});

app.setErrorHandler((error, _request, reply) => {
  app.log.error(error);

  if (error instanceof z.ZodError) {
    return reply.code(400).send({
      error: "validation_failed",
      message: "The request contains invalid values.",
      details: error.flatten(),
    });
  }

  if (error instanceof PalworldRestError) {
    const statusCode = error.statusCode === 401 ? 401 : 502;

    return reply.code(statusCode).send({
      error:
        error.statusCode === 401
          ? "authentication_failed"
          : "server_unreachable",
      message: error.message,
    });
  }

  if (
    error instanceof ServerNotFoundError ||
    error instanceof PlayerServerNotFoundError ||
    error instanceof SettingsServerNotFoundError ||
    error instanceof HistoryServerNotFoundError
  ) {
    return reply.code(404).send({
      error: "server_not_found",
      message: error.message,
    });
  }

  if (error instanceof NotificationNotFoundError) {
    return reply.code(404).send({
      error: "notification_not_found",
      message: error.message,
    });
  }

  if (error instanceof NotificationConfigurationError) {
    return reply.code(400).send({
      error: "invalid_notification_configuration",
      message: error.message,
    });
  }

  if (error instanceof NotificationDeliveryError) {
    return reply.code(502).send({
      error: "notification_delivery_failed",
      message: error.message,
    });
  }

  return reply.code(500).send({
    error: "internal_error",
    message:
      error instanceof Error ? error.message : "An unexpected error occurred.",
  });
});

try {
  await app.listen({
    host: "0.0.0.0",
    port: environment.PORT,
  });

  app.log.info(`PalCenter API listening on port ${environment.PORT}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
