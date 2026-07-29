import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDiagnostics } from "../domain/diagnostics.mjs";
import { exportSvg } from "../infrastructure/export/inkscape-exporter.mjs";
import { readJson, writeJson, writeText } from "../infrastructure/fs/file-io.mjs";
import { safeSlug } from "../infrastructure/fs/safe-slug.mjs";
import { defaultCatalogService } from "../infrastructure/catalog/catalog-service.mjs";
import { executePlanPipeline } from "./plan-pipeline.mjs";
import { metadataForPlanPath } from "../infrastructure/repositories/institution-repository.mjs";
import { readPlanWithDerivedTrackStatus } from "../infrastructure/repositories/track-plan-loader.mjs";

const thisFile = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(thisFile), "../..");

export function outputPaths(plan, options = {}) {
  const folder = options.outputDir
    ? path.resolve(options.outputDir)
    : path.join(projectRoot, "dist", safeSlug(
      plan.track?.id ? `${plan.id ?? plan.major}-${plan.track.id}` : plan.id ?? plan.planCode ?? plan.major,
      "plan",
    ));
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
  const rawPlan = readPlanWithDerivedTrackStatus(options.planPath);
  const rawCatalog = options.catalogPath ? readJson(options.catalogPath) : null;
  const colorsPath = options.colorsPath ?? path.join(projectRoot, "data", "course-colors.json");
  const colors = options.colorsPath || options.catalogPath
    ? (fs.existsSync(colorsPath) ? readJson(colorsPath) : { عام: "#616161" })
    : undefined;
  const diagnostics = createDiagnostics(path.resolve(options.planPath), options.catalogPath ? path.resolve(options.catalogPath) : null);
  const repositoryMetadata = metadataForPlanPath(options.planPath);
  const result = executePlanPipeline(rawPlan, {
    catalogService: defaultCatalogService,
    rawCatalog,
    colors,
    diagnostics,
    planPath: options.planPath,
    metadata: repositoryMetadata,
    sharedSetsRoot: options.sharedSetsRoot ?? repositoryMetadata.sharedSetsRoot,
    sharedElectivesRoot: options.sharedElectivesRoot ?? repositoryMetadata.sharedElectivesRoot,
    settingsPath: options.settingsPath ?? repositoryMetadata.settingsPath,
  });
  const resolved = result.plan;
  const paths = outputPaths(resolved, options);
  writeJson(paths.resolvedPath, resolved);
  writeJson(paths.diagnosticsPath, diagnostics);
  if (!result.ok && !options.allowErrors) {
    const error = new Error(`Generation stopped with ${diagnostics.summary.errors} error(s). See ${paths.diagnosticsPath}`);
    error.paths = paths;
    error.diagnostics = diagnostics;
    throw error;
  }
  const document = result.document;
  if (!document) throw new Error("Cannot render a plan with blocking diagnostics.");
  let exportResult = null;
  if (options.svgOnly) {
    writeText(paths.svgPath, document.svg);
  } else {
    exportResult = exportSvg(document.svg, paths, {
      keepSvg: Boolean(options.keepSvg),
      pdf: true,
      png: Boolean(options.png),
      pngWidth: options.pngWidth,
      pageCount: document.pageCount,
      inkscape: options.inkscape,
      optimizePdf: options.optimizePdf !== false,
      requirePdfOptimization: Boolean(options.requirePdfOptimization),
      ghostscript: options.ghostscript,
    });
  }
  return { plan: resolved, diagnostics, paths, exportResult };
}
