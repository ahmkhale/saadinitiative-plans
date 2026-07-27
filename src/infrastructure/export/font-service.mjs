import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const thisFile = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(thisFile), "../../..");

export const REQUIRED_FONT_FILES = Object.freeze([
  "IBMPlexSansArabic-Regular.ttf",
  "IBMPlexSansArabic-SemiBold.ttf",
  "IBMPlexSansArabic-Bold.ttf",
]);

function xml(value) {
  return String(value)
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&apos;");
}

export function resolveFontDirectory(options = {}) {
  return path.resolve(options.fontDir ?? process.env.SAAD_FONT_DIR ?? path.join(projectRoot, "font"));
}

export function assertRequiredFonts(fontDir = resolveFontDirectory()) {
  const missing = REQUIRED_FONT_FILES.filter((name) => !fs.existsSync(path.join(fontDir, name)));
  if (missing.length) {
    throw new Error(
      `Required IBM Plex Sans Arabic font files are missing from ${fontDir}: ${missing.join(", ")}. `
      + "Install them locally or set SAAD_FONT_DIR.",
    );
  }
  return fontDir;
}

export function createFontconfigEnvironment(tempDir, options = {}) {
  const fontDir = assertRequiredFonts(resolveFontDirectory(options));
  const cacheDir = path.join(tempDir, "font-cache");
  fs.mkdirSync(cacheDir, { recursive: true });
  const configPath = path.join(tempDir, "fonts.conf");
  fs.writeFileSync(configPath, [
    '<?xml version="1.0"?>',
    '<!DOCTYPE fontconfig SYSTEM "fonts.dtd">',
    "<fontconfig>",
    `  <dir>${xml(fontDir)}</dir>`,
    `  <cachedir>${xml(cacheDir)}</cachedir>`,
    "  <config><rescan><int>0</int></rescan></config>",
    "</fontconfig>",
  ].join("\n"), "utf8");
  return {
    fontDir,
    configPath,
    env: {
      ...process.env,
      FONTCONFIG_FILE: configPath,
      FONTCONFIG_PATH: path.dirname(configPath),
    },
  };
}
