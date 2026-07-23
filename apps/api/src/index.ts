import cors from "@fastify/cors";
import Fastify from "fastify";
import { z } from "zod";
import { PalworldRestError } from "./clients/palworld-rest-client.js";
import { JsonConnectionRepository } from "./repositories/json-connection-repository.js";
import { ConnectionManager } from "./services/connection-manager.js";

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

await connectionManager.initialize();

app.get("/api/health", async () => ({
  status: "ok",
  application: "PalCenter",
  version: "0.1.0",
}));

app.get("/api/servers", async () => ({
  servers: await connectionManager.list(),
}));

const connectionInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  baseUrl: z.string().url(),
  adminPassword: z.string().min(1),
});

app.post("/api/servers/test", async (request) => {
  const input = connectionInputSchema
    .omit({ name: true })
    .parse(request.body);

  return connectionManager.test(
    input.baseUrl,
    input.adminPassword,
  );
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

  return reply.code(500).send({
    error: "internal_error",
    message: error instanceof Error
      ? error.message
      : "An unexpected error occurred.",
  });
});

try {
  await app.listen({
    host: "0.0.0.0",
    port: environment.PORT,
  });

  app.log.info(
    `PalCenter API listening on port ${environment.PORT}`,
  );
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
