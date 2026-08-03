import fs from "node:fs";
import path from "node:path";
import { createDiagnostics, addDiagnostic } from "../domain/diagnostics.mjs";
import { exportSvg } from "../infrastructure/export/inkscape-exporter.mjs";
import { writeJson } from "../infrastructure/fs/file-io.mjs";
import { safeSlug } from "../infrastructure/fs/safe-slug.mjs";
import { executePlanPipeline } from "./plan-pipeline.mjs";

export function resolveDraft(rawPlan, options = {}) {
  try {
    return executePlanPipeline(rawPlan, options);
  } catch (error) {
    const diagnostics = createDiagnostics(null, options.catalogService?.malePath ?? null);
    addDiagnostic(diagnostics, "errors", "INVALID_PLAN", error.message);
    return { ok: false, plan: null, diagnostics, document: null };
  }
}

export function renderDraftPreview(rawPlan, options = {}) {
  const result = resolveDraft(rawPlan, options);
  return {
    ok: result.ok,
    plan: result.plan,
    diagnostics: result.diagnostics,
    pages: result.document?.pages ?? [],
    pageLayouts: result.document?.pageLayouts ?? [],
  };
}

export function exportDraft(rawPlan, options = {}) {
  const result = resolveDraft(rawPlan, options);
  if (!result.ok || !result.document) {
    const error = new Error(`Generation stopped with ${result.diagnostics.summary.errors} error(s).`);
    error.diagnostics = result.diagnostics;
    throw error;
  }
  const root = path.resolve(options.outputRoot ?? path.join(process.cwd(), "dist"));
  const folder = path.join(root, safeSlug(
    result.plan.track?.id
      ? `${result.plan.id ?? result.plan.major}-${result.plan.track.id}`
      : result.plan.id ?? result.plan.major,
    "plan",
  ));
  const base = options.outputName ?? "plan";
  const paths = {
    folder,
    svgPath: path.join(folder, `${base}.svg`),
    pdfPath: path.join(folder, `${base}.pdf`),
    pngPath: path.join(folder, `${base}.png`),
    resolvedPath: path.join(folder, `${base}.resolved.json`),
    diagnosticsPath: path.join(folder, `${base}.diagnostics.json`),
  };
  fs.mkdirSync(folder, { recursive: true });
  writeJson(paths.resolvedPath, result.plan);
  writeJson(paths.diagnosticsPath, result.diagnostics);
  const exportResult = exportSvg(result.document.svg, paths, {
    keepSvg: Boolean(options.keepSvg),
    pdf: options.pdf !== false,
    png: Boolean(options.png),
    pageCount: result.document.pageCount,
    pages: result.document.pages,
    pageLayouts: result.document.pageLayouts,
    pngWidth: options.pngWidth,
    inkscape: options.inkscape,
    optimizePdf: options.optimizePdf !== false,
    requirePdfOptimization: Boolean(options.requirePdfOptimization),
    ghostscript: options.ghostscript,
  });
  return { ...result, paths, exportResult };
}
