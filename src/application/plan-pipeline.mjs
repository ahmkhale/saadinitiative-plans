import { buildCourseCatalog } from "../catalog.mjs";
import { defaultCatalogService } from "../catalog-service.mjs";
import { createDiagnostics, hasErrors } from "../diagnostics.mjs";
import { normalizePlanInput, validatePlanShape } from "../plan-input.mjs";
import { renderPlanDocumentSvg } from "../presentation/svg/document.mjs";
import { resolvePlan } from "../resolve.mjs";
import { composeSharedElectiveGroups, loadSharedElectiveGroups } from "../shared-elective-groups.mjs";
import { composeSharedSemesterSets, loadSharedSemesterSets } from "../shared-semester-sets.mjs";
import { readSettings } from "../settings.mjs";
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
  const document = hasErrors(diagnostics) ? null : renderPlanDocumentSvg(plan);
  return { ok: !hasErrors(diagnostics), plan, diagnostics, document };
}
