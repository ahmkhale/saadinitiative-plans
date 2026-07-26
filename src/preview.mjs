import fs from "node:fs";
import path from "node:path";
import { createDiagnostics, addDiagnostic, hasErrors } from "./diagnostics.mjs";
import { exportSvg } from "./exporter.mjs";
import { writeJson } from "./io.mjs";
import { safeSlug } from "./normalize.mjs";
import { normalizePlanInput, validatePlanShape } from "./plan-input.mjs";
import { renderPlanDocumentSvg } from "./render-svg.mjs";
import { resolvePlan } from "./resolve.mjs";
import { defaultCatalogService } from "./catalog-service.mjs";

export function resolveDraft(rawPlan, options = {}) {
  const service = options.catalogService ?? defaultCatalogService;
  const diagnostics = createDiagnostics(null, service.malePath);
  let normalized;
  try {
    normalized = normalizePlanInput(structuredClone(rawPlan));
    validatePlanShape(normalized);
  } catch (error) {
    addDiagnostic(diagnostics, "errors", "INVALID_PLAN", error.message);
    return { ok: false, plan: null, diagnostics, document: null };
  }
  const catalog = service.snapshot();
  const plan = resolvePlan(normalized, catalog.catalog, catalog.colors, diagnostics);
  const document = hasErrors(diagnostics) ? null : renderPlanDocumentSvg(plan);
  return { ok: !hasErrors(diagnostics), plan, diagnostics, document };
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
  const folder = path.join(root, safeSlug(result.plan.id ?? result.plan.major, "plan"));
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
  exportSvg(result.document.svg, paths, {
    keepSvg: Boolean(options.keepSvg),
    pdf: options.pdf !== false,
    png: Boolean(options.png),
    pageCount: result.document.pageCount,
    pngWidth: options.pngWidth,
    inkscape: options.inkscape,
  });
  return { ...result, paths };
}
