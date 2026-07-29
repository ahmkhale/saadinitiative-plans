import { spawnSync } from "node:child_process";
import { findChromium } from "../src/exporter.mjs";

const chromium = findChromium();

if (!chromium) {
  console.log("Browser-render verification skipped: Chromium is not installed.");
  process.exit(0);
}

const probe = spawnSync(chromium, [
  "--headless",
  "--no-sandbox",
  "--disable-gpu",
  "--dump-dom",
  "data:text/html,<p>saad-browser-probe</p>",
], { encoding: "utf8", timeout: 4000 });

if (probe.error?.code === "ETIMEDOUT" || probe.signal || !probe.stdout?.includes("saad-browser-probe")) {
  console.log("Browser-render verification skipped: Chromium cannot complete a headless render in this environment.");
  process.exit(0);
}

const result = spawnSync(process.execPath, ["--test", "test/browser-render.test.mjs"], {
  cwd: process.cwd(),
  env: { ...process.env, RUN_BROWSER_RENDER_TESTS: "1" },
  stdio: "inherit",
});
process.exit(result.status ?? 1);
