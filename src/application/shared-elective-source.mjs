import { addDiagnostic } from "../domain/diagnostics.mjs";
import { assertStableId } from "../domain/ids.mjs";
import { normalizeCourseCode, numericValue } from "../domain/course-code.mjs";
import { canonicalFallbackCourses } from "../domain/plan-normalization.mjs";
import { normalizeSharedScope } from "../domain/shared-scope.mjs";

export function normalizeSharedElectiveSource(input, forcedId = null) {
  const id = assertStableId(forcedId ?? input?.id, "sharedElectiveGroupId");
  const name = String(input?.name ?? "").trim();
  if (!name) throw new Error("اسم مجموعة المقررات الاختيارية مطلوب.");
  const requiredHours = numericValue(input?.requiredHours);
  if (requiredHours === null || requiredHours < 0) throw new Error("الساعات المطلوبة يجب أن تكون صفرًا أو أكثر.");
  return {
    schemaVersion: 1,
    id,
    name,
    requiredHours,
    excludePublishedCourses: input?.excludePublishedCourses !== false,
    courses: (input?.courses ?? []).map((entry) => (
      typeof entry === "string"
        ? normalizeCourseCode(entry)
        : { ...entry, code: normalizeCourseCode(entry.code) }
    )),
    fallbackCourses: canonicalFallbackCourses(input?.fallbackCourses ?? {}),
    scope: normalizeSharedScope(input?.scope),
  };
}

export function composeSharedElectiveGroups(plan, sources, diagnostics) {
  const result = structuredClone(plan);
  const inheritedFallbacks = {};
  result.electiveGroups = (result.electiveGroups ?? []).flatMap((group, index) => {
    if (!group?.sourceId) return [group];
    const source = sources.get(group.sourceId);
    if (!source) {
      addDiagnostic(diagnostics, "errors", "BROKEN_SHARED_ELECTIVE_REFERENCE", `Shared elective source '${group.sourceId}' was not found.`, {
        sourceId: group.sourceId,
        location: `elective-${index + 1}`,
      });
      return [];
    }
    Object.assign(inheritedFallbacks, structuredClone(source.fallbackCourses ?? {}));
    return [{
      sourceId: source.id,
      sharedSource: true,
      name: source.name,
      requiredHours: source.requiredHours,
      originalRequiredHours: source.requiredHours,
      excludePublishedCourses: source.excludePublishedCourses !== false,
      sortCourses: "code",
      courses: source.courses.map((entry) => (
        typeof entry === "string" ? { code: entry } : structuredClone(entry)
      )),
    }];
  });
  result.fallbackCourses = { ...inheritedFallbacks, ...(result.fallbackCourses ?? {}) };
  return result;
}
