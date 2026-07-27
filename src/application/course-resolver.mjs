import { addDiagnostic } from "../domain/diagnostics.mjs";
import {
  courseCodeKey,
  courseSubject,
  normalizeCourseCode,
  numericValue,
} from "../domain/course-code.mjs";
import { normalizeActivityFacts } from "../domain/course-facts.mjs";
import { formatCourseRequirementLabel } from "../domain/course-requirements.mjs";

const FACT_FIELDS = Object.freeze([
  "name",
  "academicHours",
  "lectureHours",
  "practicalHours",
  "exerciseHours",
  "category",
  "color",
  "extinct",
]);

export function compactFacts(value = {}) {
  const facts = {};
  for (const field of FACT_FIELDS) {
    if (value[field] !== undefined && value[field] !== null && value[field] !== "") facts[field] = value[field];
  }
  return facts;
}

export function mergeFacts(...sources) {
  const result = {};
  for (const source of sources) {
    const compact = compactFacts(source);
    for (const [key, value] of Object.entries(compact)) result[key] = value;
  }
  return result;
}

export function createFallbackMap(plan) {
  const map = new Map();
  for (const [code, facts] of Object.entries(plan.fallbackCourses ?? {})) {
    map.set(courseCodeKey(code), {
      code: normalizeCourseCode(code),
      ...compactFacts(facts),
      sourceType: facts.source ?? "manual",
      manuallyEditedFields: structuredClone(facts.manuallyEditedFields ?? []),
      source: "plan-fallback",
    });
  }
  return map;
}

export function normalizeCodeList(values) {
  return Array.from(new Set((values ?? []).map(normalizeCourseCode).filter(Boolean)));
}

export function createCourseResolver({ plan, catalog, colors, diagnostics }) {
  const fallbacks = createFallbackMap(plan);
  const seen = new Map();
  const allCourses = [];
  const mainCourses = [];
  const semesterLookup = new Map();

  function resolveEntry(entry, context) {
    const code = normalizeCourseCode(entry.code);
    const key = courseCodeKey(code);
    if (seen.has(key)) {
      addDiagnostic(diagnostics, "errors", "DUPLICATE_COURSE", `${code} appears more than once in the plan.`, {
        course: code,
        firstLocation: seen.get(key),
        location: context.location,
      });
    } else {
      seen.set(key, context.location);
    }

    const fallbackRecord = fallbacks.get(key);
    const fallback = mergeFacts(fallbackRecord ?? {}, entry.fallback ?? {});
    const fallbackManualFields = new Set(fallbackRecord?.manuallyEditedFields ?? []);
    const fallbackIsCatalogSnapshot = fallbackRecord?.sourceType === "catalog";
    const catalogFacts = entry.forceFallback ? {} : compactFacts(catalog.get(key) ?? {});
    const override = compactFacts(entry.override ?? {});
    const mergedFacts = mergeFacts(fallback, catalogFacts, override, { extinct: entry.extinct });
    const activity = normalizeActivityFacts(mergedFacts);
    const facts = activity.facts;
    const usedCatalog = Object.keys(catalogFacts).length > 0;
    const usedFallback = !usedCatalog && Object.keys(fallback).length > 0;

    const manualMissing = usedFallback
      ? ["name", "academicHours", "lectureHours", "exerciseHours", "practicalHours"]
        .filter((field) => field === "name" ? !facts.name : numericValue(facts[field]) === null)
      : [];
    if (!facts.name || numericValue(facts.academicHours) === null) {
      addDiagnostic(diagnostics, "errors", "UNRESOLVED_COURSE", `${code} is missing required facts in both courses.json and plan fallback.`, {
        course: code,
        missing: [!facts.name ? "name" : null, numericValue(facts.academicHours) === null ? "academicHours" : null].filter(Boolean),
        location: context.location,
      });
    } else if (activity.allUnknown) {
      addDiagnostic(diagnostics, "errors", "UNKNOWN_ACTIVITY_HOURS", `${code} has no known lecture, exercise, or practical hours.`, {
        course: code,
        location: context.location,
      });
    } else if (manualMissing.length) {
      addDiagnostic(diagnostics, "errors", "INCOMPLETE_MANUAL_COURSE", `${code} has incomplete manual course facts.`, {
        course: code,
        missing: manualMissing,
        location: context.location,
      });
    } else if (usedFallback) {
      addDiagnostic(
        diagnostics,
        "info",
        fallbackIsCatalogSnapshot ? "CATALOG_FALLBACK_SNAPSHOT_USED" : "FALLBACK_USED",
        fallbackIsCatalogSnapshot
          ? `${code} was resolved from its stored catalog snapshot.`
          : `${code} was not found in courses.json; manual plan fallback was used.`,
        { course: code, location: context.location },
      );
    }
    if (activity.normalizedFields.length) {
      addDiagnostic(diagnostics, "info", "ACTIVITY_HOURS_NORMALIZED", `${code} missing activity values were normalized to zero.`, {
        course: code,
        fields: activity.normalizedFields,
        location: context.location,
      });
    }
    const rawCatalog = catalog.get(key);
    if (rawCatalog?.conflicts?.length) {
      addDiagnostic(diagnostics, "warnings", "CONFLICTING_CATALOG_FACTS", `${code} has conflicting section-derived facts that need review.`, {
        course: code,
        conflicts: rawCatalog.conflicts,
        location: context.location,
      });
    }
    if (usedCatalog && fallbackRecord) {
      const manualFields = [...fallbackManualFields]
        .filter((field) => fallback[field] !== undefined && catalogFacts[field] !== undefined && fallback[field] !== catalogFacts[field]);
      if (manualFields.length) {
        addDiagnostic(diagnostics, "warnings", "MANUAL_FALLBACK_DIFFERS", `${code} has manual fallback facts that differ from the current catalog.`, {
          course: code,
          fields: manualFields,
          location: context.location,
        });
      } else if (fallbackIsCatalogSnapshot) {
        addDiagnostic(diagnostics, "info", "CATALOG_FALLBACK_SNAPSHOT", `${code} has a durable catalog fallback snapshot.`, {
          course: code,
          location: context.location,
        });
      }
    }

    let prerequisites = normalizeCodeList(entry.prerequisites);
    let corequisites = normalizeCodeList(entry.corequisites);
    const prerequisiteConditions = Array.from(new Set(
      (entry.prerequisiteConditions ?? []).map((value) => String(value).trim()).filter(Boolean),
    ));
    if (context.sameGroupKeys) {
      const sameSemesterPrerequisites = prerequisites.filter((prerequisite) => context.sameGroupKeys.has(courseCodeKey(prerequisite)));
      if (sameSemesterPrerequisites.length && entry.preserveSameSemesterPrerequisite !== true) {
        corequisites = normalizeCodeList([...corequisites, ...sameSemesterPrerequisites]);
        const corequisiteKeys = new Set(corequisites.map(courseCodeKey));
        prerequisites = prerequisites.filter((prerequisite) => !corequisiteKeys.has(courseCodeKey(prerequisite)));
      }
    }

    const subject = courseSubject(code);
    const category = facts.category || subject || "عام";
    const color = facts.color || plan.courseColors?.[subject] || plan.courseColors?.[category] || colors[subject] || colors[category] || colors.عام || "#616161";
    if (!facts.color && !plan.courseColors?.[subject] && !colors[subject] && !colors[category]) {
      addDiagnostic(diagnostics, "warnings", "UNKNOWN_COLOR", `${code} has no known course color; عام was used.`, { course: code, subject });
    }

    const course = {
      id: entry.id ?? null,
      code,
      key,
      name: facts.name ?? "مقرر غير معروف",
      academicHours: numericValue(facts.academicHours) ?? 0,
      lectureHours: numericValue(facts.lectureHours),
      practicalHours: numericValue(facts.practicalHours),
      exerciseHours: numericValue(facts.exerciseHours),
      prerequisites,
      corequisites,
      prerequisiteConditions,
      minimumCompletedCredits: numericValue(entry.minimumCompletedCredits),
      category,
      subject,
      color,
      requirement: entry.requirement ?? "required",
      isTrackSpecific: Boolean(entry.trackSpecific),
      isExtinct: Boolean(facts.extinct),
      isPlaceholder: false,
      isMissingFromCatalog: !usedCatalog,
      source: usedCatalog ? "catalog" : usedFallback ? (fallbackIsCatalogSnapshot ? "catalog-snapshot" : "fallback") : "unresolved",
      catalogSource: usedCatalog
        ? rawCatalog?.catalogSource ?? "catalog"
        : usedFallback ? (fallbackIsCatalogSnapshot ? "catalog-snapshot" : "manual") : null,
      sourceBadge: usedCatalog
        ? rawCatalog?.catalogSource === "female" ? "دليل الطالبات" : rawCatalog?.catalogSource === "male" ? "دليل الطلاب" : "دليل المقررات"
        : usedFallback ? (fallbackIsCatalogSnapshot ? "لقطة من الدليل" : "مدخل يدويًا") : "غير موجود في الدليل",
      qualityBadges: [
        ...(rawCatalog?.conflicts?.length || rawCatalog?.crossSourceConflict ? ["بيانات متعارضة"] : []),
        ...(usedCatalog && [facts.name, facts.academicHours, facts.lectureHours, facts.exerciseHours, facts.practicalHours]
          .some((value) => value === null || value === undefined || value === "") ? ["بيانات ناقصة"] : []),
      ],
      location: context.location,
    };
    course.requirementLabel = formatCourseRequirementLabel(course);
    allCourses.push(course);
    if (context.semesterIndex !== null && context.semesterIndex !== undefined) {
      mainCourses.push(course);
      if (!semesterLookup.has(key)) semesterLookup.set(key, context.semesterIndex);
    }
    return course;
  }

  return Object.freeze({
    allCourses,
    mainCourses,
    semesterLookup,
    resolveEntry,
  });
}
