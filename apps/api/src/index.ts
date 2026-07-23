import cors from "@fastify/cors";
import Fastify from "fastify";
import { z } from "zod";
import { PalworldRestError } from "./clients/palworld-rest-client.js";
import { JsonConnectionRepository } from "./repositories/json-connection-repository.js";
import { ConnectionManager } from "./services/connection-manager.js";
import {
  PlayerServerNotFoundError,
  PlayerService,
} from "./services/player-service.js";
import {
  ServerAdminService,
  ServerNotFoundError,
} from "./services/server-admin-service.js";
import { ServerStatusService } from "./services/server-status-service.js";

const environmentSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  CONFIG_DIR: z.string().min(1).default("./data"),
});

const environment = environmentSchema.parse(process.env);

const app = Fastify({
  logger: true,
});

await app.register(cors, {
  origin: true,
});

const repository = new JsonConnectionRepository(environment.CONFIG_DIR);
const connectionManager = new ConnectionManager(repository);
const playerService = new PlayerService(repository);
const serverAdminService = new ServerAdminService(repository);
const serverStatusService = new ServerStatusService(repository);

await connectionManager.initialize();

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
    error instanceof PlayerServerNotFoundError
  ) {
    return reply.code(404).send({
      error: "server_not_found",
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
