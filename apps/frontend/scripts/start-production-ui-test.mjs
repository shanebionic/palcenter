import { spawn } from "node:child_process";
import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { startMockUiApi } from "./mock-ui-api.mjs";

const standaloneRoot = path.resolve(".next/standalone/apps/frontend");
await mkdir(path.join(standaloneRoot, ".next"), { recursive: true });
await cp(
  path.resolve(".next/static"),
  path.join(standaloneRoot, ".next/static"),
  { recursive: true },
);
await cp(path.resolve("public"), path.join(standaloneRoot, "public"), {
  recursive: true,
});

const apiPort = 3198;
const api = await startMockUiApi(apiPort);
const frontend = spawn(
  process.execPath,
  [path.join(standaloneRoot, "server.js")],
  {
    env: {
      ...process.env,
      PALCENTER_API_INTERNAL_URL: `http://127.0.0.1:${apiPort}`,
    },
    stdio: "inherit",
  },
);

function close(signal) {
  frontend.kill(signal);
  api.close();
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => close(signal));
}

frontend.on("exit", (code) => {
  api.close();
  process.exitCode = code ?? 0;
});
