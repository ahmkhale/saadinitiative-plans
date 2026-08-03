import { spawn } from "node:child_process";
import process from "node:process";

const isWindows = process.platform === "win32";
const pnpm = isWindows ? "pnpm.cmd" : "pnpm";
const viteCommand = isWindows ? (process.env.ComSpec ?? "cmd.exe") : pnpm;
const viteArgs = isWindows
  ? ["/d", "/s", "/c", `${pnpm} --dir gui-app dev`]
  : ["--dir", "gui-app", "dev"];
const api = spawn(process.execPath, ["src/gui-server.mjs"], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: "4175" },
  stdio: "inherit",
  windowsHide: true,
});
const vite = spawn(viteCommand, viteArgs, {
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

