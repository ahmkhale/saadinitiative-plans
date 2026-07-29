import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { exportPagesToPdf } from "./chromium-pdf-exporter.mjs";
import { createFontconfigEnvironment } from "./font-service.mjs";
import { optimizePdf } from "./pdf-optimizer.mjs";

function existingFile(candidate) {
  return Boolean(candidate && fs.existsSync(candidate) && fs.statSync(candidate).isFile());
}

export function findInkscape() {
  if (existingFile(process.env.INKSCAPE_PATH)) return process.env.INKSCAPE_PATH;
  const candidates = process.platform === "win32"
    ? [
        path.join(process.env.PROGRAMFILES ?? "", "Inkscape", "bin", "inkscape.exe"),
        path.join(process.env.PROGRAMFILES ?? "", "Inkscape", "inkscape.exe"),
      ]
    : process.platform === "darwin"
      ? ["/Applications/Inkscape.app/Contents/MacOS/inkscape"]
      : ["/usr/bin/inkscape", "/usr/local/bin/inkscape", "/snap/bin/inkscape"];
  return candidates.find(existingFile) ?? "inkscape";
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", shell: false, env: options.env ?? process.env });
  if (result.error) {
    if (result.error.code === "ENOENT") throw new Error("Inkscape was not found. Install Inkscape or set INKSCAPE_PATH.");
    throw result.error;
  }
  if (result.status !== 0) throw new Error(`${path.basename(command)} exited with code ${result.status}: ${result.stderr?.trim() ?? ""}`);
}

export function exportSvg(svg, paths, options = {}) {
  fs.mkdirSync(path.dirname(paths.svgPath), { recursive: true });
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "saad-plan-"));
  const tempSvg = path.join(tempDir, "plan.svg");
  const fontconfig = createFontconfigEnvironment(tempDir, { fontDir: options.fontDir });
  fs.writeFileSync(tempSvg, svg, "utf8");
  let pdfExport = null;
  let pdfOptimization = null;
  try {
    if (options.keepSvg) fs.copyFileSync(tempSvg, paths.svgPath);
    if (options.pdf !== false) {
      pdfExport = exportPagesToPdf(options.pages ?? [svg], paths.pdfPath, {
        chromium: options.chromium,
        fontDir: fontconfig.fontDir,
      });
      pdfOptimization = optimizePdf(paths.pdfPath, {
        enabled: options.optimizePdf !== false,
        required: Boolean(options.requirePdfOptimization),
        ghostscript: options.ghostscript,
      });
    }
    if (options.png) {
      const pageCount = Math.max(1, Number(options.pageCount ?? 1));
      for (let page = 1; page <= pageCount; page += 1) {
        const outputPath = page === 1
          ? paths.pngPath
          : path.join(path.dirname(paths.pngPath), `${path.basename(paths.pngPath, path.extname(paths.pngPath))}-page-${page}${path.extname(paths.pngPath)}`);
        const args = [
          tempSvg,
          "--export-type=png",
          `--export-filename=${outputPath}`,
          "--export-area-page",
          `--export-width=${options.pngWidth ?? 2000}`,
        ];
        if (pageCount > 1) args.push(`--export-page=${page}`);
        run(options.inkscape ?? findInkscape(), args, { env: fontconfig.env });
      }
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  return Object.freeze({ pdfExport, pdfOptimization });
}
