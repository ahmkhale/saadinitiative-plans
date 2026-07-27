import { FALLBACK_FACT_FIELDS, normalizeActivityFacts } from "../domain/course-facts.mjs";
import { courseCodeKey, normalizeCourseCode } from "../domain/course-code.mjs";

function ownedCodes(owner) {
  const semesterCodes = (owner.semesters ?? []).flatMap((semester) => semester.courses ?? []);
  const electiveCodes = (owner.electiveGroups ?? [])
    .filter((group) => !group.sourceId)
    .flatMap((group) => group.courses ?? []);
  return [...semesterCodes, ...electiveCodes]
    .filter((entry) => entry?.kind !== "placeholder")
    .map((entry) => normalizeCourseCode(typeof entry === "string" ? entry : entry.code))
    .filter(Boolean);
}

function isPresent(value) {
  return value !== null && value !== undefined && value !== "";
}

export function hydrateFallbackCourses(owner, catalog, options = {}) {
  const result = structuredClone(owner ?? {});
  const fallbackCourses = structuredClone(result.fallbackCourses ?? {});
  const diagnostics = [];
  const codes = options.codes ?? ownedCodes(result);

  for (const code of Array.from(new Set(codes.map(normalizeCourseCode)))) {
    const catalogFacts = catalog.get(courseCodeKey(code));
    if (!catalogFacts) continue;
    const current = structuredClone(fallbackCourses[code] ?? {});
    const manuallyEditedFields = new Set(current.manuallyEditedFields ?? []);
    const normalizedCatalog = normalizeActivityFacts(catalogFacts).facts;
    let changed = false;
    for (const field of FALLBACK_FACT_FIELDS) {
      if (!isPresent(current[field]) || !manuallyEditedFields.has(field)) {
        if (isPresent(normalizedCatalog[field])) {
          if (current[field] !== normalizedCatalog[field]) changed = true;
          current[field] = normalizedCatalog[field];
        }
      }
    }
    current.source = current.source === "manual" && manuallyEditedFields.size ? "manual" : "catalog";
    current.manuallyEditedFields = [...manuallyEditedFields];
    fallbackCourses[code] = current;
    if (changed || !owner.fallbackCourses?.[code]) diagnostics.push({ code, action: "created-or-refreshed" });
  }
  result.fallbackCourses = fallbackCourses;
  return { value: result, diagnostics };
}

export function refreshFallbackFromCatalog(owner, code, catalog) {
  const result = structuredClone(owner ?? {});
  const normalizedCode = normalizeCourseCode(code);
  const catalogFacts = catalog.get(courseCodeKey(normalizedCode));
  if (!catalogFacts) throw new Error(`${normalizedCode} is not available in the current catalog.`);
  const normalized = normalizeActivityFacts(catalogFacts).facts;
  result.fallbackCourses ??= {};
  result.fallbackCourses[normalizedCode] = {
    ...Object.fromEntries(FALLBACK_FACT_FIELDS.map((field) => [field, normalized[field] ?? null])),
    source: "catalog",
    manuallyEditedFields: [],
  };
  return result;
}
