import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCourseCatalog } from "./catalog.mjs";
import { createDiagnostics, hasErrors } from "./diagnostics.mjs";
import { exportSvg } from "./exporter.mjs";
import { readJson, writeJson, writeText } from "./io.mjs";
import { normalizePlanInput, validatePlanShape } from "./plan-input.mjs";
import { renderPlanDocumentSvg } from "./render-svg.mjs";
import { resolvePlan } from "./resolve.mjs";
import { safeSlug } from "./normalize.mjs";

const thisFile = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(thisFile), "..");

export function outputPaths(plan, options = {}) {
  const folder = options.outputDir
    ? path.resolve(options.outputDir)
    : path.join(projectRoot, "dist", safeSlug(plan.id ?? plan.planCode ?? plan.major, "plan"));
  const base = options.outputName ?? "plan";
  return {
    folder,
    svgPath: path.join(folder, `${base}.svg`),
    pdfPath: path.join(folder, `${base}.pdf`),
    pngPath: path.join(folder, `${base}.png`),
    resolvedPath: path.join(folder, `${base}.resolved.json`),
    diagnosticsPath: path.join(folder, `${base}.diagnostics.json`),
  };
}

export function generatePlan(options) {
  const rawPlan = readJson(options.planPath);
  const plan = normalizePlanInput(rawPlan, { planId: options.planId });
  validatePlanShape(plan);
  const rawCatalog = options.catalogPath ? readJson(options.catalogPath) : [];
  const catalog = buildCourseCatalog(rawCatalog);
  const colorsPath = options.colorsPath ?? path.join(projectRoot, "data", "course-colors.json");
  const colors = fs.existsSync(colorsPath) ? readJson(colorsPath) : { عام: "#616161" };
  const diagnostics = createDiagnostics(path.resolve(options.planPath), options.catalogPath ? path.resolve(options.catalogPath) : null);
  const resolved = resolvePlan(plan, catalog, colors, diagnostics);
  const paths = outputPaths(resolved, options);
  writeJson(paths.resolvedPath, resolved);
  writeJson(paths.diagnosticsPath, diagnostics);
  if (hasErrors(diagnostics) && !options.allowErrors) {
    const error = new Error(`Generation stopped with ${diagnostics.summary.errors} error(s). See ${paths.diagnosticsPath}`);
    error.paths = paths;
    error.diagnostics = diagnostics;
    throw error;
  }
  const document = renderPlanDocumentSvg(resolved);
  if (options.svgOnly) {
    writeText(paths.svgPath, document.svg);
  } else {
    exportSvg(document.svg, paths, {
      keepSvg: Boolean(options.keepSvg),
      pdf: true,
      png: Boolean(options.png),
      pngWidth: options.pngWidth,
      pageCount: document.pageCount,
      inkscape: options.inkscape,
    });
  }
  return { plan: resolved, diagnostics, paths };
}
