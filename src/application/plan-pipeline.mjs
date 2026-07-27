import { buildCourseCatalog } from "../infrastructure/catalog/catalog-aggregator.mjs";
import { defaultCatalogService } from "../infrastructure/catalog/catalog-service.mjs";
import { addDiagnostic, createDiagnostics, hasErrors } from "../domain/diagnostics.mjs";
import { normalizePlanInput, validatePlanShape } from "../plan-input.mjs";
import { renderPlanDocumentSvg } from "../presentation/svg/document.mjs";
import { validateRenderedText } from "../presentation/layout/text-validation.mjs";
import { resolvePlan } from "./resolve-plan.mjs";
import { composeSharedElectiveGroups, composeSharedSemesterSets } from "./compose-published-plan.mjs";
import { loadSharedElectiveGroups } from "../infrastructure/repositories/shared-elective-repository.mjs";
import { loadSharedSemesterSets } from "../infrastructure/repositories/shared-semester-repository.mjs";
import { readSettings } from "../infrastructure/repositories/settings-repository.mjs";
import { scopeAllows } from "../domain/shared-scope.mjs";

function applicableSources(sources, metadata, majorId) {
  if (!metadata?.institutionId) return sources;
  const context = {
    institutionId: metadata.institutionId,
    collegeId: metadata.collegeId,
    majorId,
  };
  return new Map([...sources].filter(([, source]) => scopeAllows(source.scope, context)));
}

export function executePlanPipeline(rawPlan, options = {}) {
  const service = options.catalogService ?? defaultCatalogService;
  const diagnostics = options.diagnostics ?? createDiagnostics(options.planPath ?? null, service.malePath ?? null);
  const normalized = normalizePlanInput({
    ...structuredClone(rawPlan),
    ...(options.metadata ?? {}),
  });
  validatePlanShape(normalized);

  const snapshot = options.rawCatalog
    ? { catalog: buildCourseCatalog(options.rawCatalog), colors: options.colors ?? {} }
    : service.snapshot();
  const sharedSemesterSets = options.sharedSemesterSets
    ?? loadSharedSemesterSets(options.sharedSetsRoot);
  const sharedElectiveGroups = options.sharedElectiveGroups
    ?? loadSharedElectiveGroups(options.sharedElectivesRoot);
  const semestersComposed = composeSharedSemesterSets(
    normalized,
    applicableSources(sharedSemesterSets, options.metadata, normalized.id),
    diagnostics,
  );
  const composed = composeSharedElectiveGroups(
    semestersComposed,
    applicableSources(sharedElectiveGroups, options.metadata, normalized.id),
    diagnostics,
  );
  const plan = resolvePlan(composed, snapshot.catalog, options.colors ?? snapshot.colors, diagnostics, {
    settings: options.settings ?? readSettings(options.settingsPath),
  });
  let document = null;
  try {
    validateRenderedText(plan, diagnostics);
    if (!hasErrors(diagnostics)) document = renderPlanDocumentSvg(plan);
  } catch (error) {
    addDiagnostic(diagnostics, "errors", "PRESENTATION_UNAVAILABLE", error.message, {
      cause: error.name,
    });
  }
  return { ok: !hasErrors(diagnostics), plan, diagnostics, document };
}
