import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function existingFile(candidate) {
  return Boolean(candidate && fs.existsSync(candidate) && fs.statSync(candidate).isFile());
}

function commandWorks(command) {
  if (!command) return false;
  const result = spawnSync(command, ["--version"], { encoding: "utf8", shell: false });
  return !result.error && result.status === 0;
}

function versionDirectories(root) {
  if (!root || !fs.existsSync(root) || !fs.statSync(root).isDirectory()) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(root, entry.name))
    .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }));
}

function windowsCandidates() {
  const roots = [
    path.join(process.env.PROGRAMFILES ?? "", "gs"),
    path.join(process.env["PROGRAMFILES(X86)"] ?? "", "gs"),
  ];
  const installed = roots.flatMap((root) => versionDirectories(root).flatMap((folder) => [
    path.join(folder, "bin", "gswin64c.exe"),
    path.join(folder, "bin", "gswin32c.exe"),
  ]));
  return [
    process.env.GHOSTSCRIPT_PATH,
    ...installed,
    "gswin64c.exe",
    "gswin32c.exe",
    "gs.exe",
  ];
}

export function findGhostscript() {
  const candidates = process.platform === "win32"
    ? windowsCandidates()
    : [process.env.GHOSTSCRIPT_PATH, "/opt/homebrew/bin/gs", "/usr/local/bin/gs", "/usr/bin/gs", "gs"];
  for (const candidate of candidates.filter(Boolean)) {
    if (existingFile(candidate) || commandWorks(candidate)) return candidate;
  }
  return null;
}

function runGhostscript(command, inputPath, outputPath) {
  const args = [
    "-q",
    "-dNOPAUSE",
    "-dBATCH",
    "-dSAFER",
    "-sDEVICE=pdfwrite",
    "-dCompatibilityLevel=1.7",
    "-dAutoRotatePages=/None",
    "-dDetectDuplicateImages=true",
    "-dCompressFonts=true",
    "-dSubsetFonts=true",
    "-dEmbedAllFonts=true",
    "-dPreserveAnnots=true",
    `-sOutputFile=${outputPath}`,
    inputPath,
  ];
  const result = spawnSync(command, args, { encoding: "utf8", shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${path.basename(command)} exited with code ${result.status}: ${result.stderr?.trim() ?? ""}`);
  }
}

function replaceAtomically(sourcePath, replacementPath) {
  const backupPath = `${sourcePath}.unoptimized-${process.pid}-${Date.now()}`;
  fs.renameSync(sourcePath, backupPath);
  try {
    fs.renameSync(replacementPath, sourcePath);
    fs.rmSync(backupPath, { force: true });
  } catch (error) {
    if (fs.existsSync(sourcePath)) fs.rmSync(sourcePath, { force: true });
    fs.renameSync(backupPath, sourcePath);
    throw error;
  }
}

/**
 * Rewrites an Inkscape PDF through Ghostscript's pdfwrite device.
 *
 * Inkscape preserves many SVG groups as separate Form XObjects. Ghostscript
 * safely collapses those groups into compact page content streams while
 * retaining vector artwork, subset fonts, page dimensions, and URL
 * annotations. Optimization is opportunistic: when Ghostscript is missing,
 * the already compact pre-composed Inkscape PDF remains valid.
 */
export function optimizePdf(pdfPath, options = {}) {
  if (options.enabled === false) return Object.freeze({ optimized: false, reason: "disabled" });
  const ghostscript = options.ghostscript ?? findGhostscript();
  if (!ghostscript) {
    if (options.required) throw new Error("Ghostscript was not found. Install it or set GHOSTSCRIPT_PATH to enable maximum PDF compression.");
    return Object.freeze({ optimized: false, reason: "ghostscript-not-found" });
  }

  const originalSize = fs.statSync(pdfPath).size;
  const temporaryPath = `${pdfPath}.optimized-${process.pid}-${Date.now()}.pdf`;
  try {
    runGhostscript(ghostscript, pdfPath, temporaryPath);
    const optimizedSize = fs.statSync(temporaryPath).size;
    if (optimizedSize >= originalSize) {
      fs.rmSync(temporaryPath, { force: true });
      return Object.freeze({ optimized: false, reason: "not-smaller", originalSize, optimizedSize });
    }
    replaceAtomically(pdfPath, temporaryPath);
    return Object.freeze({ optimized: true, ghostscript, originalSize, optimizedSize });
  } catch (error) {
    fs.rmSync(temporaryPath, { force: true });
    if (options.required) throw error;
    return Object.freeze({ optimized: false, reason: "optimization-failed", error: error.message, originalSize });
  }
}
