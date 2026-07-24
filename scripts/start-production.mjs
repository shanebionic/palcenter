import { spawn } from "node:child_process";

const apiPort = process.env.API_PORT ?? "3001";
const webPort = process.env.WEB_PORT ?? "3000";
const configDirectory = process.env.CONFIG_DIR ?? "/app/data";
const version = process.env.PALCENTER_VERSION ?? "development";

console.info(
  `Starting PalCenter ${version} (web=${webPort}, api=${apiPort}, data=${configDirectory}).`,
);

const processes = [
  spawn(process.execPath, ["/app/apps/api/dist/index.js"], {
    env: {
      ...process.env,
      PORT: apiPort,
      CONFIG_DIR: configDirectory,
    },
    stdio: "inherit",
  }),
  spawn(process.execPath, ["/app/frontend/apps/frontend/server.js"], {
    env: {
      ...process.env,
      PORT: webPort,
      HOSTNAME: "0.0.0.0",
      PALCENTER_API_INTERNAL_URL: `http://127.0.0.1:${apiPort}`,
    },
    stdio: "inherit",
  }),
];

let stopping = false;

function stop(signal) {
  if (stopping) {
    return;
  }

  stopping = true;

  for (const child of processes) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
}

for (const child of processes) {
  child.on("error", (error) => {
    console.error("PalCenter process failed to start.", error);
    process.exitCode = 1;
    stop("SIGTERM");
  });

  child.on("exit", (code, signal) => {
    if (!stopping) {
      console.error(
        `PalCenter process exited unexpectedly (${signal ?? code ?? "unknown"}).`,
      );
      process.exitCode = code && code > 0 ? code : 1;
      stop("SIGTERM");
    }
  });
}

process.on("SIGTERM", () => {
  console.info("Stopping PalCenter after SIGTERM.");
  stop("SIGTERM");
});
process.on("SIGINT", () => {
  console.info("Stopping PalCenter after SIGINT.");
  stop("SIGINT");
});
