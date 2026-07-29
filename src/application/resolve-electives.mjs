import { addDiagnostic } from "../domain/diagnostics.mjs";
import { formatRequiredHours } from "../domain/arabic-format.mjs";
import { compareCourseCodes, courseCodeKey, normalizeCourseCode, numericValue } from "../domain/course-code.mjs";

export function resolveElectiveGroups(plan, resolver, diagnostics) {
  const publishedHours = new Map(resolver.mainCourses.map((course) => [course.key, course.academicHours]));
  const fallbackHours = new Map(Object.entries(plan.fallbackCourses ?? {}).map(([code, facts]) => [
    courseCodeKey(code),
    numericValue(facts.academicHours),
  ]));
  return (plan.electiveGroups ?? []).map((group, groupIndex) => {
    const excluded = [];
    const candidateEntries = (group.courses ?? []).filter((entry) => {
      if (!group.sharedSource || group.excludePublishedCourses === false) return true;
      const code = normalizeCourseCode(entry.code);
      const key = courseCodeKey(code);
      if (!publishedHours.has(key)) return true;
      if (!excluded.some((item) => item.key === key)) {
        const academicHours = group.sharedSource
          ? fallbackHours.get(key) ?? publishedHours.get(key) ?? 0
          : publishedHours.get(key) ?? 0;
        excluded.push({ code, key, academicHours });
        addDiagnostic(diagnostics, "info", "ELECTIVE_CANDIDATE_EXCLUDED", `${code} was excluded because it already exists in a published semester.`, {
          course: code,
          sourceId: group.sourceId,
          location: `elective-${group.sourceId}`,
        });
      }
      return false;
    });
    const resolvedCourses = candidateEntries.map((entry, entryIndex) => resolver.resolveEntry(entry, {
      semesterIndex: null,
      entryIndex,
      sameGroupKeys: null,
      location: `elective-${group.id ?? groupIndex + 1}`,
    }));
    if ((group.sortCourses ?? "code") === "code") resolvedCourses.sort((a, b) => compareCourseCodes(a.code, b.code));
    const originalRequiredHours = numericValue(group.originalRequiredHours ?? group.requiredHours);
    const excludedHours = excluded.reduce((sum, course) => sum + course.academicHours, 0);
    const effectiveRequiredHours = group.sharedSource && group.excludePublishedCourses !== false
      ? Math.max(0, (originalRequiredHours ?? 0) - excludedHours)
      : numericValue(group.requiredHours);
    const hasHours = effectiveRequiredHours !== null;
    const hasText = Boolean(String(group.requirementText ?? "").trim());
    if (hasHours === hasText) {
      addDiagnostic(diagnostics, "errors", hasHours ? "ELECTIVE_REQUIREMENT_BOTH" : "ELECTIVE_REQUIREMENT_MISSING", `${group.name} must use either required hours or custom requirement text.`, {
        location: `elective-${group.id ?? groupIndex + 1}`,
      });
    }
    const requiredHours = hasHours && !hasText ? effectiveRequiredHours : null;
    const requirementText = hasText && !hasHours ? String(group.requirementText).trim() : null;
    return {
      id: group.id ?? `elective-group-${groupIndex + 1}`,
      name: group.name ?? `مجموعة اختيارية ${groupIndex + 1}`,
      sourceId: group.sourceId ?? null,
      sharedSource: Boolean(group.sharedSource),
      excludePublishedCourses: group.sharedSource ? group.excludePublishedCourses !== false : null,
      originalRequiredHours: group.sharedSource ? originalRequiredHours : null,
      excludedCourses: excluded,
      requiredHours,
      requirementText,
      displayRequirement: requirementText ?? formatRequiredHours(requiredHours ?? 0),
      courseDisplayOrder: group.courseDisplayOrder ?? ((group.sortCourses ?? "code") === "code" ? "rtl" : "ltr"),
      courses: resolvedCourses,
    };
  }).filter((group) => !(group.sharedSource && group.requiredHours === 0 && group.courses.length === 0));
}
