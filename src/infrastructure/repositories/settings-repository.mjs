import fs from "node:fs";
import path from "node:path";
import { atomicWriteJson, projectRoot } from "./plan-repository.mjs";

export const settingsPath = path.resolve(
  process.env.SAAD_PLANS_SETTINGS_PATH
    ?? path.join(projectRoot, "institutions", "ksu", "settings.json"),
);

export function defaultSettings() {
  return { edition: "الطبعة الرابعة", release: "إصدار 472.1" };
}

export function readSettings(filePath = settingsPath) {
  if (!fs.existsSync(filePath)) return defaultSettings();
  return { ...defaultSettings(), ...JSON.parse(fs.readFileSync(filePath, "utf8")) };
}

export function saveSettings(input, filePath = settingsPath) {
  const edition = String(input?.edition ?? "").trim();
  const release = String(input?.release ?? "").trim();
  if (!edition) throw new Error("الطبعة مطلوبة.");
  if (!release) throw new Error("الإصدار مطلوب.");
  const settings = { edition, release };
  atomicWriteJson(filePath, settings);
  return settings;
}
