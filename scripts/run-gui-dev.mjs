import { spawn } from "node:child_process";
import process from "node:process";

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const api = spawn(process.execPath, ["src/gui-server.mjs"], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: "4175" },
  stdio: "inherit",
  windowsHide: true,
});
const vite = spawn(pnpm, ["--dir", "gui-app", "dev"], {
  cwd: process.cwd(),
  stdio: "inherit",
  windowsHide: true,
});

let closing = false;
function close(code = 0) {
  if (closing) return;
  closing = true;
  api.kill();
  vite.kill();
  process.exitCode = code;
}

api.on("exit", (code) => close(code ?? 0));
vite.on("exit", (code) => close(code ?? 0));
process.on("SIGINT", () => close(0));
process.on("SIGTERM", () => close(0));

