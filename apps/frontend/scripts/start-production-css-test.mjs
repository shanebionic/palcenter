import { spawn } from "node:child_process";
import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const standaloneRoot = path.resolve(".next/standalone/apps/frontend");
await mkdir(path.join(standaloneRoot, ".next"), { recursive: true });
await cp(
  path.resolve(".next/static"),
  path.join(standaloneRoot, ".next/static"),
  {
    recursive: true,
  },
);
await cp(path.resolve("public"), path.join(standaloneRoot, "public"), {
  recursive: true,
});

const server = spawn(
  process.execPath,
  [path.join(standaloneRoot, "server.js")],
  {
    env: process.env,
    stdio: "inherit",
  },
);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.kill(signal));
}

server.on("exit", (code) => {
  process.exitCode = code ?? 0;
});
