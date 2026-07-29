import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { assertRequiredFonts, resolveFontDirectory } from "./font-service.mjs";

const FONT_FACES = Object.freeze([
  { file: "IBMPlexSansArabic-Regular.ttf", weight: 400 },
  { file: "IBMPlexSansArabic-Medium.ttf", weight: 500 },
  { file: "IBMPlexSansArabic-SemiBold.ttf", weight: 600 },
  { file: "IBMPlexSansArabic-Bold.ttf", weight: 700 },
]);

function existingFile(candidate) {
  return Boolean(candidate && fs.existsSync(candidate) && fs.statSync(candidate).isFile());
}

function commandWorks(command) {
  if (!command) return false;
  const result = spawnSync(command, ["--version"], {
    encoding: "utf8",
    shell: false,
    windowsHide: true,
  });
  return !result.error && result.status === 0;
}

export function findChromium() {
  const configured = [
    process.env.SAAD_CHROMIUM_PATH,
    process.env.CHROMIUM_PATH,
    process.env.CHROME_PATH,
    process.env.EDGE_PATH,
  ];
  const candidates = process.platform === "win32"
    ? [
        ...configured,
        path.join(process.env.PROGRAMFILES ?? "", "Google", "Chrome", "Application", "chrome.exe"),
        path.join(process.env["PROGRAMFILES(X86)"] ?? "", "Google", "Chrome", "Application", "chrome.exe"),
        path.join(process.env.LOCALAPPDATA ?? "", "Google", "Chrome", "Application", "chrome.exe"),
        path.join(process.env.PROGRAMFILES ?? "", "Microsoft", "Edge", "Application", "msedge.exe"),
        path.join(process.env["PROGRAMFILES(X86)"] ?? "", "Microsoft", "Edge", "Application", "msedge.exe"),
      ]
    : process.platform === "darwin"
      ? [
          ...configured,
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
          "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
          "/Applications/Chromium.app/Contents/MacOS/Chromium",
        ]
      : [
          ...configured,
          "/usr/bin/chromium",
          "/usr/bin/chromium-browser",
          "/usr/bin/google-chrome",
          "/usr/bin/google-chrome-stable",
          "/usr/bin/microsoft-edge",
          "chromium",
          "chromium-browser",
          "google-chrome",
        ];
  for (const candidate of candidates.filter(Boolean)) {
    if (existingFile(candidate) || (process.platform !== "win32" && commandWorks(candidate))) return candidate;
  }
  return null;
}

function pageDimensions(svg) {
  const match = svg.match(/data-page-width="([0-9.]+)" data-page-height="([0-9.]+)"/u);
  if (!match) throw new Error("Could not read generated SVG page dimensions for PDF export.");
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!(width > 0 && height > 0)) throw new Error("Generated SVG page dimensions must be positive.");
  return { width, height };
}

function embeddedSvg(svg) {
  return svg.replace(/^\s*<\?xml[^>]*>\s*/u, "");
}

function cssUrl(filePath) {
  return pathToFileURL(filePath).href.replaceAll('"', "%22");
}

export function buildPdfHtml(pages, options = {}) {
  if (!Array.isArray(pages) || pages.length === 0) {
    throw new Error("PDF export requires at least one independently sized SVG page.");
  }
  const fontDir = assertRequiredFonts(resolveFontDirectory(options));
  const missing = FONT_FACES
    .map(({ file }) => file)
    .filter((file) => !fs.existsSync(path.join(fontDir, file)));
  if (missing.length) {
    throw new Error(`Required browser-export font files are missing from ${fontDir}: ${missing.join(", ")}.`);
  }
  const dimensions = pages.map(pageDimensions);
  const fontFaces = FONT_FACES.map(({ file, weight }) => [
    "@font-face{",
    'font-family:"IBM Plex Sans Arabic";',
    "font-style:normal;",
    `font-weight:${weight};`,
    `src:url("${cssUrl(path.join(fontDir, file))}") format("truetype");`,
    "}",
  ].join("")).join("");
  const pageRules = dimensions.map(({ width, height }, index) => [
    `@page saad-page-${index + 1}{size:${width}pt ${height}pt;margin:0}`,
    `.saad-page-${index + 1}{page:saad-page-${index + 1};width:${width}pt;height:${height}pt}`,
  ].join("")).join("");
  const content = pages.map((svg, index) => (
    `<section class="saad-pdf-page saad-page-${index + 1}">${embeddedSvg(svg)}</section>`
  )).join("");
  return [
    "<!doctype html>",
    '<html><head><meta charset="utf-8"><style>',
    fontFaces,
    "*{box-sizing:border-box}",
    "html,body{margin:0;padding:0}",
    ".saad-pdf-page{break-after:page;overflow:hidden;print-color-adjust:exact;-webkit-print-color-adjust:exact}",
    ".saad-pdf-page:last-child{break-after:auto}",
    ".saad-pdf-page>svg{display:block}",
    pageRules,
    "</style></head><body>",
    content,
    "</body></html>",
  ].join("");
}

function replaceAtomically(targetPath, replacementPath) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  if (!fs.existsSync(targetPath)) {
    fs.renameSync(replacementPath, targetPath);
    return;
  }
  const previousPath = `${targetPath}.previous-${process.pid}-${Date.now()}`;
  fs.renameSync(targetPath, previousPath);
  try {
    fs.renameSync(replacementPath, targetPath);
    fs.rmSync(previousPath, { force: true });
  } catch (error) {
    if (fs.existsSync(targetPath)) fs.rmSync(targetPath, { force: true });
    fs.renameSync(previousPath, targetPath);
    throw error;
  }
}

export function exportPagesToPdf(pages, outputPath, options = {}) {
  const chromium = options.chromium ?? findChromium();
  if (!chromium) {
    throw new Error(
      "Chromium was not found. Install Chrome, Chromium, or Edge, "
      + "or set SAAD_CHROMIUM_PATH to enable searchable Arabic PDF export.",
    );
  }
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "saad-browser-pdf-"));
  const htmlPath = path.join(tempDir, "plan.html");
  const temporaryPdf = path.join(tempDir, "plan.pdf");
  const profileDir = path.join(tempDir, "profile");
  try {
    fs.writeFileSync(htmlPath, buildPdfHtml(pages, options), "utf8");
    const args = [
      "--headless",
      "--disable-gpu",
      "--disable-extensions",
      "--allow-file-access-from-files",
      "--no-first-run",
      "--no-pdf-header-footer",
      `--user-data-dir=${profileDir}`,
      `--print-to-pdf=${temporaryPdf}`,
      pathToFileURL(htmlPath).href,
    ];
    const result = spawnSync(chromium, args, {
      encoding: "utf8",
      shell: false,
      timeout: 60_000,
      windowsHide: true,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(`${path.basename(chromium)} exited with code ${result.status}: ${result.stderr?.trim() ?? ""}`);
    }
    if (!fs.existsSync(temporaryPdf) || fs.statSync(temporaryPdf).size < 5) {
      throw new Error(`${path.basename(chromium)} did not produce a PDF.`);
    }
    const signature = fs.readFileSync(temporaryPdf).subarray(0, 5).toString("ascii");
    if (signature !== "%PDF-") throw new Error(`${path.basename(chromium)} produced an invalid PDF.`);
    const size = fs.statSync(temporaryPdf).size;
    replaceAtomically(outputPath, temporaryPdf);
    return Object.freeze({ engine: "chromium", chromium, size, tagged: true });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}
