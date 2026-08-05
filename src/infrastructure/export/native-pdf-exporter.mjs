import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { assertRequiredFonts, resolveFontDirectory } from "./font-service.mjs";
import { buildPlanPdfMetadata } from "./pdf-metadata.mjs";

function replaceAtomically(destination, replacement) {
  const previous = `${destination}.previous-${process.pid}-${Date.now()}`;
  if (!fs.existsSync(destination)) {
    fs.renameSync(replacement, destination);
    return;
  }
  fs.renameSync(destination, previous);
  try {
    fs.renameSync(replacement, destination);
    fs.rmSync(previous, { force: true });
  } catch (error) {
    if (fs.existsSync(destination)) fs.rmSync(destination, { force: true });
    fs.renameSync(previous, destination);
    throw error;
  }
}

export function exportNativePdf(pages, pageLayouts, pdfPath, options = {}) {
  if (!Array.isArray(pages) || !pages.length) throw new Error("Native PDF export requires at least one rendered page.");
  if (!Array.isArray(pageLayouts) || pageLayouts.length !== pages.length) {
    throw new Error("Native PDF export requires one measured layout for every page.");
  }
  const fontDir = assertRequiredFonts(resolveFontDirectory(options));
  fs.mkdirSync(path.dirname(pdfPath), { recursive: true });
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "saad-native-pdf-"));
  const descriptorPath = path.join(tempDir, "descriptor.json");
  const temporaryPdf = path.join(path.dirname(pdfPath), `.${path.basename(pdfPath)}.${process.pid}.${Date.now()}.tmp`);
  const metadata = options.metadata ?? buildPlanPdfMetadata(options.plan, options.context);
  try {
    fs.writeFileSync(descriptorPath, JSON.stringify({
      pages,
      pageLayouts,
      fontDir,
      outputPath: temporaryPdf,
      metadata,
    }), "utf8");
    const worker = fileURLToPath(new URL("./native-pdf-worker.mjs", import.meta.url));
    const result = spawnSync(process.execPath, [worker, descriptorPath], {
      encoding: "utf8",
      shell: false,
      maxBuffer: 10 * 1024 * 1024,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(`Native PDF export failed: ${result.stderr?.trim() || result.stdout?.trim() || `exit ${result.status}`}`);
    }
    replaceAtomically(pdfPath, temporaryPdf);
    return Object.freeze({
      renderer: "native-pdfkit",
      size: fs.statSync(pdfPath).size,
    });
  } finally {
    fs.rmSync(temporaryPdf, { force: true });
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}
