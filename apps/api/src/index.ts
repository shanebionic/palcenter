import cors from "@fastify/cors";
import Fastify from "fastify";
import { z } from "zod";
import { PalworldRestError } from "./clients/palworld-rest-client.js";
import { NotificationDeliveryError } from "./providers/notification-provider.js";
import { JsonConnectionRepository } from "./repositories/json-connection-repository.js";
import { JsonNotificationRepository } from "./repositories/json-notification-repository.js";
import { SqliteHistoryRepository } from "./repositories/sqlite-history-repository.js";
import { SqliteUserRepository } from "./repositories/sqlite-user-repository.js";
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
import { AuthenticationService } from "./services/authentication-service.js";
import { AuthorizationService } from "./services/authorization-service.js";
import {
  BackupRestoreError,
  BackupService,
  InvalidBackupError,
} from "./services/backup-service.js";
import { notificationEventTypes } from "./types/notifications.js";
import { userRoles } from "./types/users.js";
import { PasswordService } from "./services/password-service.js";
import {
  InvalidCurrentPasswordError,
  SetupUnavailableError,
  UserConflictError,
  UserNotFoundError,
  UserSafetyError,
  UserService,
} from "./services/user-service.js";

const booleanEnvironmentValue = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

const environmentSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  CONFIG_DIR: z.string().min(1).default("./data"),
  HISTORY_INTERVAL_SECONDS: z.coerce.number().int().min(5).default(30),
  PALCENTER_VERSION: z.string().trim().min(1).max(50).default("development"),
  PALCENTER_SESSION_SECRET: z.string().min(32),
  PALCENTER_SESSION_DURATION_SECONDS: z.coerce
    .number()
    .int()
    .min(300)
    .max(604_800)
    .default(43_200),
  PALCENTER_SESSION_COOKIE_SECURE: booleanEnvironmentValue.default("false"),
  PALCENTER_CORS_ORIGINS: z.string().default(""),
  PALCENTER_TRUST_PROXY: booleanEnvironmentValue.default("false"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  PALCENTER_BACKUP_MAX_BYTES: z.coerce
    .number()
    .int()
    .min(1_048_576)
    .max(1_073_741_824)
    .default(536_870_912),
});

const parsedEnvironment = environmentSchema.safeParse(process.env);

if (!parsedEnvironment.success) {
  console.error("PalCenter configuration is invalid.");

  for (const issue of parsedEnvironment.error.issues) {
    console.error(
      `- ${issue.path.join(".") || "environment"}: ${issue.message}`,
    );
  }

  process.exit(1);
}

const environment = parsedEnvironment.data;

const app = Fastify({
  bodyLimit: 64 * 1_024,
  trustProxy: environment.PALCENTER_TRUST_PROXY,
  logger: {
    level: environment.LOG_LEVEL,
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "res.headers.set-cookie",
        "req.body.adminPassword",
        "req.body.password",
        "req.body.currentPassword",
        "req.body.newPassword",
        "req.body.passwordConfirmation",
        "req.body.passwordHash",
        "req.body.webhookUrl",
      ],
      censor: "[REDACTED]",
    },
  },
});

for (const contentType of ["application/gzip", "application/octet-stream"]) {
  app.addContentTypeParser(
    contentType,
    { parseAs: "buffer" },
    (_request, body, done) => done(null, body),
  );
}

const allowedOrigins = new Set(
  environment.PALCENTER_CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);

await app.register(cors, {
  credentials: true,
  origin(origin, callback) {
    callback(null, !origin || allowedOrigins.has(origin));
  },
});

const repository = new JsonConnectionRepository(environment.CONFIG_DIR);
const historyRepository = new SqliteHistoryRepository(environment.CONFIG_DIR);
const userRepository = new SqliteUserRepository(environment.CONFIG_DIR);
const notificationRepository = new JsonNotificationRepository(
  environment.CONFIG_DIR,
);
const passwordService = new PasswordService();
const userService = new UserService(userRepository, passwordService);
const authenticationService = new AuthenticationService(
  {
    sessionSecret: environment.PALCENTER_SESSION_SECRET,
    sessionDurationSeconds: environment.PALCENTER_SESSION_DURATION_SECONDS,
    secureCookie: environment.PALCENTER_SESSION_COOKIE_SECURE,
  },
  userRepository,
  passwordService,
);
const authorizationService = new AuthorizationService();
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
const historyErrorHandler = (error: unknown) => {
  app.log.error({ err: error }, "Historical metric collection failed.");
};
const backupService = new BackupService(
  environment.CONFIG_DIR,
  environment.PALCENTER_VERSION,
  {
    async pause() {
      await serverHistoryService.stop();
      historyRepository.close();
      userRepository.close();
    },
    async resume() {
      historyRepository.reopen();
      userRepository.reopen();
      serverHistoryService.start(historyErrorHandler);
    },
  },
);

try {
  await connectionManager.initialize();
  await notificationRepository.initialize();
  historyRepository.initialize();
  userRepository.initialize();
} catch (error) {
  app.log.fatal({ err: error }, "PalCenter data initialization failed.");
  process.exit(1);
}

serverHistoryService.start(historyErrorHandler);

app.addHook("onClose", async () => {
  await serverHistoryService.stop();
  historyRepository.close();
  userRepository.close();
});

const publicApiRoutes = new Set([
  "/api/health",
  "/api/auth/login",
  "/api/auth/session",
  "/api/auth/setup-status",
  "/api/auth/setup",
]);

app.addHook("onRequest", async (request, reply) => {
  const path = request.url.split("?")[0];
  const origin = request.headers.origin;
  const isStateChanging = !["GET", "HEAD", "OPTIONS"].includes(request.method);
  const requestOrigin = `${request.protocol}://${request.headers.host}`;

  if (
    isStateChanging &&
    origin &&
    origin !== requestOrigin &&
    !allowedOrigins.has(origin)
  ) {
    return reply.code(403).send({
      error: "origin_not_allowed",
      message: "The request origin is not allowed.",
    });
  }

  if (backupService.isDataUnavailable()) {
    return reply.code(503).send({
      error: "maintenance_in_progress",
      message:
        "PalCenter data is temporarily unavailable during backup maintenance.",
    });
  }

  if (
    request.method === "OPTIONS" ||
    !path.startsWith("/api/") ||
    publicApiRoutes.has(path)
  ) {
    return;
  }

  if (userService.setupRequired()) {
    return reply.code(409).send({
      error: "setup_required",
      message: "Complete the PalCenter first-run setup.",
    });
  }

  const session = authenticationService.sessionFromCookie(
    request.headers.cookie,
  );
  if (!session) {
    return reply.code(401).send({
      error: "authentication_required",
      message: "Sign in to access PalCenter.",
    });
  }

  if (
    session.user.mustChangePassword &&
    path !== "/api/users/me" &&
    path !== "/api/users/me/password" &&
    path !== "/api/auth/logout"
  ) {
    return reply.code(403).send({
      error: "password_change_required",
      message: "Change your temporary password before continuing.",
    });
  }

  if (
    path !== "/api/users/me" &&
    path !== "/api/users/me/password" &&
    path !== "/api/auth/logout" &&
    !authorizationService.can(
      session.user.role,
      authorizationService.permissionFor(request.method, path),
    )
  ) {
    return reply.code(403).send({
      error: "insufficient_permissions",
      message: "Your account does not have permission for this action.",
    });
  }

});

app.addHook("onSend", async (_request, reply, payload) => {
  reply.header("Cache-Control", "no-store");
  reply.header("X-Content-Type-Options", "nosniff");
  reply.header("X-Frame-Options", "DENY");
  reply.header("Referrer-Policy", "no-referrer");
  return payload;
});

const loginSchema = z
  .object({
    username: z.string().min(1).max(80),
    password: z.string().min(1).max(1_024),
  })
  .strict();
const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(80)
  .regex(
    /^[a-zA-Z0-9._-]+$/,
    "Use letters, numbers, periods, underscores, or hyphens.",
  );
const emailSchema = z.string().trim().toLowerCase().email().max(254);
const passwordSchema = z
  .string()
  .min(12)
  .max(1_024)
  .refine(
    (value) =>
      /[a-z]/.test(value) &&
      /[A-Z]/.test(value) &&
      /\d/.test(value) &&
      /[^a-zA-Z0-9]/.test(value),
    "Use upper- and lowercase letters, a number, and a symbol.",
  );

app.get("/api/auth/setup-status", async () => ({
  setupRequired: userService.setupRequired(),
}));

app.post("/api/auth/setup", async (request, reply) => {
  const input = z
    .object({
      username: usernameSchema,
      email: emailSchema,
      password: passwordSchema,
      passwordConfirmation: z.string(),
    })
    .strict()
    .refine((value) => value.password === value.passwordConfirmation, {
      path: ["passwordConfirmation"],
      message: "Passwords do not match.",
    })
    .parse(request.body);
  const user = await userService.setup(input);
  const token = authenticationService.createSessionFor(user.id);
  reply.header("Set-Cookie", authenticationService.sessionCookie(token));
  return reply.code(201).send({
    authenticated: true,
    user,
    version: environment.PALCENTER_VERSION,
  });
});

app.post("/api/auth/login", async (request, reply) => {
  if (userService.setupRequired()) {
    return reply.code(409).send({
      error: "setup_required",
      message: "Complete the PalCenter first-run setup.",
    });
  }
  if (authenticationService.isRateLimited(request.ip)) {
    return reply.code(429).send({
      error: "too_many_login_attempts",
      message: "Too many login attempts. Try again in 15 minutes.",
    });
  }

  const input = loginSchema.parse(request.body);
  const result = await authenticationService.login(
    input.username,
    input.password,
    request.ip,
  );

  if (!result) {
    return reply.code(401).send({
      error: "invalid_credentials",
      message: "The username or password is incorrect.",
    });
  }

  reply.header("Set-Cookie", authenticationService.sessionCookie(result.token));
  return {
    authenticated: true,
    user: result.user,
    version: environment.PALCENTER_VERSION,
  };
});

app.get("/api/auth/session", async (request, reply) => {
  const session = authenticationService.sessionFromCookie(
    request.headers.cookie,
  );

  if (!session) {
    return reply.code(401).send({
      authenticated: false,
      message: "Authentication is required.",
    });
  }

  return {
    authenticated: true,
    user: session.user,
    version: environment.PALCENTER_VERSION,
  };
});

app.post("/api/auth/logout", async (_request, reply) => {
  reply.header("Set-Cookie", authenticationService.clearSessionCookie());
  return { authenticated: false };
});

app.get("/api/health", async (_request, reply) => {
  try {
    await repository.list();
    await notificationRepository.list();
    historyRepository.check();
    userRepository.check();

    return {
      status: "ok",
      application: "PalCenter",
      version: environment.PALCENTER_VERSION,
      storage: "ready",
      setupRequired: userService.setupRequired(),
    };
  } catch (error) {
    app.log.error({ err: error }, "Health check failed.");
    return reply.code(503).send({
      status: "degraded",
      application: "PalCenter",
      version: environment.PALCENTER_VERSION,
      storage: "unavailable",
    });
  }
});

const currentUser = (cookie: string | undefined) => {
  const session = authenticationService.sessionFromCookie(cookie);
  if (!session) throw new Error("Authenticated session is unavailable.");
  return session.user;
};

app.get("/api/users/me", async (request) =>
  userService.get(currentUser(request.headers.cookie).id),
);

app.post("/api/users/me/password", async (request, reply) => {
  const input = z
    .object({
      currentPassword: z.string().min(1).max(1_024),
      newPassword: passwordSchema,
      passwordConfirmation: z.string(),
    })
    .strict()
    .refine((value) => value.newPassword === value.passwordConfirmation, {
      path: ["passwordConfirmation"],
      message: "Passwords do not match.",
    })
    .parse(request.body);
  await userService.changePassword(
    currentUser(request.headers.cookie).id,
    input.currentPassword,
    input.newPassword,
  );
  reply.header("Set-Cookie", authenticationService.clearSessionCookie());
  return {
    success: true,
    message: "Password changed. Sign in again with your new password.",
  };
});

const userIdSchema = z.object({ id: z.string().min(1) });
const userIdentitySchema = z.object({
  username: usernameSchema,
  email: emailSchema,
});
const userCreateSchema = userIdentitySchema
  .extend({
    password: passwordSchema,
    role: z.enum(userRoles),
  })
  .strict();
const userUpdateSchema = userIdentitySchema
  .extend({
    role: z.enum(userRoles),
    enabled: z.boolean(),
  })
  .strict();

app.get("/api/users", async () => ({ users: userService.list() }));

app.post("/api/users", async (request, reply) => {
  const input = userCreateSchema.parse(request.body);
  return reply.code(201).send(await userService.create(input));
});

app.patch("/api/users/:id", async (request) => {
  const parameters = userIdSchema.parse(request.params);
  return userService.update(
    parameters.id,
    userUpdateSchema.parse(request.body),
  );
});

app.post("/api/users/:id/password", async (request) => {
  const parameters = userIdSchema.parse(request.params);
  const input = z
    .object({ password: passwordSchema })
    .strict()
    .parse(request.body);
  await userService.resetPassword(parameters.id, input.password);
  return {
    success: true,
    message: "Temporary password assigned. The user must change it at sign-in.",
  };
});

app.delete("/api/users/:id", async (request, reply) => {
  const parameters = userIdSchema.parse(request.params);
  userService.delete(parameters.id);
  return reply.code(204).send();
});

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

const httpUrlSchema = z
  .string()
  .max(2_048)
  .url()
  .refine((value) => {
    const url = new URL(value);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    );
  }, "Enter an HTTP or HTTPS URL without embedded credentials.");
const baseHttpUrlSchema = httpUrlSchema.refine((value) => {
  const url = new URL(value);
  return !url.search && !url.hash;
}, "Base URLs cannot include query parameters or fragments.");
const connectionInputSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    baseUrl: baseHttpUrlSchema,
    adminPassword: z.string().min(1).max(1_024),
  })
  .strict();

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
  const input = z
    .object({ message: messageSchema })
    .strict()
    .parse(request.body);

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
    .strict()
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
const notificationBaseSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    enabled: z.boolean(),
    events: notificationEventsSchema,
  })
  .strict();
const discordNotificationSchema = notificationBaseSchema.extend({
  type: z.literal("discord"),
  webhookUrl: httpUrlSchema,
});
const ntfyNotificationSchema = notificationBaseSchema.extend({
  type: z.literal("ntfy"),
  serverUrl: baseHttpUrlSchema,
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

app.get("/api/backup/info", async () => backupService.info());

app.post("/api/backup", async (_request, reply) => {
  const backup = await backupService.create();
  reply.header("Content-Type", "application/gzip");
  reply.header(
    "Content-Disposition",
    `attachment; filename="${backup.filename}"`,
  );
  return reply.send(backup.contents);
});

app.post(
  "/api/backup/restore",
  { bodyLimit: environment.PALCENTER_BACKUP_MAX_BYTES },
  async (request, reply) => {
    if (
      request.headers["x-palcenter-confirm-restore"] !== "replace-current-data"
    ) {
      return reply.code(400).send({
        error: "restore_confirmation_required",
        message: "Administrator restore confirmation is required.",
      });
    }

    if (!Buffer.isBuffer(request.body) || request.body.length === 0) {
      return reply.code(400).send({
        error: "invalid_backup",
        message: "Upload a PalCenter .tar.gz backup archive.",
      });
    }

    const metadata = await backupService.restore(request.body);
    return {
      success: true,
      message: "Backup restored successfully.",
      metadata,
    };
  },
);

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

app.setErrorHandler((error, request, reply) => {
  app.log.error(
    { err: error, requestId: request.id },
    "Request processing failed.",
  );

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

  if (error instanceof InvalidBackupError) {
    return reply.code(400).send({
      error: "invalid_backup",
      message: error.message,
    });
  }

  if (error instanceof BackupRestoreError) {
    return reply.code(500).send({
      error: "restore_failed",
      message: error.message,
    });
  }

  if (error instanceof UserNotFoundError) {
    return reply.code(404).send({
      error: "user_not_found",
      message: error.message,
    });
  }

  if (
    error instanceof UserConflictError ||
    error instanceof UserSafetyError ||
    error instanceof InvalidCurrentPasswordError ||
    error instanceof SetupUnavailableError
  ) {
    return reply.code(400).send({
      error: "user_operation_failed",
      message: error.message,
    });
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof error.statusCode === "number" &&
    error.statusCode >= 400 &&
    error.statusCode < 500
  ) {
    return reply.code(error.statusCode).send({
      error: "invalid_request",
      message: "The request could not be processed.",
    });
  }

  return reply.code(500).send({
    error: "internal_error",
    message: "An unexpected error occurred.",
  });
});

try {
  await app.listen({
    host: "0.0.0.0",
    port: environment.PORT,
  });

  app.log.info(
    {
      version: environment.PALCENTER_VERSION,
      port: environment.PORT,
      configDirectory: environment.CONFIG_DIR,
      historyIntervalSeconds: environment.HISTORY_INTERVAL_SECONDS,
      corsOrigins: allowedOrigins.size,
      secureSessionCookie: environment.PALCENTER_SESSION_COOKIE_SECURE,
      trustProxy: environment.PALCENTER_TRUST_PROXY,
    },
    "PalCenter API started.",
  );

  if (!environment.PALCENTER_SESSION_COOKIE_SECURE) {
    app.log.warn(
      "Session cookies are not marked Secure. Use HTTPS and enable PALCENTER_SESSION_COOKIE_SECURE in production.",
    );
  }
} catch (error) {
  app.log.fatal({ err: error }, "PalCenter API failed to start.");
  process.exit(1);
}
