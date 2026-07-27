import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as fontkit from "fontkit";

const thisFile = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(thisFile), "../../..");
const fontRoot = path.resolve(process.env.SAAD_FONT_DIR ?? path.join(projectRoot, "font"));
const FONT_FILES = Object.freeze({
  semibold: "IBMPlexSansArabic-SemiBold.ttf",
  bold: "IBMPlexSansArabic-Bold.ttf",
});
const fonts = new Map();

function loadFont(style) {
  if (fonts.has(style)) return fonts.get(style);
  const filePath = path.join(fontRoot, FONT_FILES[style]);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Required local font is missing: ${filePath}. Install IBM Plex Sans Arabic locally or set SAAD_FONT_DIR.`);
  }
  const font = fontkit.openSync(filePath);
  fonts.set(style, font);
  return font;
}

export function measureText(value, size, style = "semibold") {
  const font = loadFont(style);
  const run = font.layout(String(value ?? ""));
  return (run.advanceWidth / font.unitsPerEm) * Number(size);
}

export function fitMeasuredText(value, {
  baseSize,
  minimumSize,
  maxWidth,
  style = "semibold",
  precision = 0.001,
} = {}) {
  const text = String(value ?? "");
  const baseWidth = measureText(text, baseSize, style);
  if (!text || baseWidth <= maxWidth) {
    return Object.freeze({ size: baseSize, width: baseWidth, overflow: false, reduced: false });
  }
  const minimumWidth = measureText(text, minimumSize, style);
  if (minimumWidth > maxWidth) {
    return Object.freeze({ size: minimumSize, width: minimumWidth, overflow: true, reduced: true });
  }
  let low = minimumSize;
  let high = baseSize;
  while (high - low > precision) {
    const middle = (low + high) / 2;
    if (measureText(text, middle, style) <= maxWidth) low = middle;
    else high = middle;
  }
  const size = Math.floor(low / precision) * precision;
  return Object.freeze({
    size,
    width: measureText(text, size, style),
    overflow: false,
    reduced: true,
  });
}
