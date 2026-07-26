import { addDiagnostic } from "./diagnostics.mjs";
import { compareCourseCodes, courseCodeKey, courseSubject, normalizeCourseCode, numericValue, toWesternDigits } from "./normalize.mjs";
import { normalizeActivityFacts } from "./course-facts.mjs";
import { courseNameFit, prerequisiteFit } from "./text-measure.mjs";
import { reconcileProposal } from "./proposal-reconciliation.mjs";

const FACT_FIELDS = [
  "name", "academicHours", "lectureHours", "practicalHours", "exerciseHours",
  "prerequisites", "corequisites", "minimumCompletedCredits", "category", "color",
  "trackSpecific", "extinct", "requirement",
];

function compactFacts(value = {}) {
  const facts = {};
  for (const field of FACT_FIELDS) {
    if (value[field] !== undefined && value[field] !== null && value[field] !== "") facts[field] = value[field];
  }
  return facts;
}

function mergeFacts(...sources) {
  const result = {};
  for (const source of sources) {
    const compact = compactFacts(source);
    for (const [key, value] of Object.entries(compact)) result[key] = value;
  }
  return result;
}

function fallbackMap(plan) {
  const map = new Map();
  for (const [code, facts] of Object.entries(plan.fallbackCourses ?? {})) {
    map.set(courseCodeKey(code), {
      code: normalizeCourseCode(code),
      ...compactFacts(facts),
      _provenance: structuredClone(facts._provenance ?? {}),
      source: "plan-fallback",
    });
  }
  return map;
}

function isCourseRequirement(value) {
  const text = toWesternDigits(value).replace(/\s+/gu, " ").trim();
  if (!text || /(?:مستوى|اتمام|إتمام|ساعة|ساعات)/u.test(text)) return false;
  return /^(?:\d+[A-Za-z]?\s+[^\d\s]+|[^\d\s]+\s+\d+[A-Za-z]?)$/u.test(text);
}

function splitRequirements(values) {
  const courses = [];
  const conditions = [];
  for (const value of values ?? []) {
    const text = toWesternDigits(value).replace(/\s+/gu, " ").trim();
    if (!text) continue;
    if (isCourseRequirement(text)) courses.push(normalizeCourseCode(text));
    else conditions.push(text);
  }
  return {
    courses: Array.from(new Set(courses)),
    conditions: Array.from(new Set(conditions)),
  };
}

function normalizeCodeList(values) {
  return splitRequirements(values).courses;
}

function detectCycles(coursesByKey, diagnostics) {
  const state = new Map();
  const stack = [];
  function visit(key) {
    const status = state.get(key) ?? 0;
    if (status === 2) return;
    if (status === 1) {
      const start = stack.indexOf(key);
      const cycle = [...stack.slice(start), key].map((item) => coursesByKey.get(item)?.code ?? item);
      addDiagnostic(diagnostics, "errors", "PREREQUISITE_CYCLE", `Circular prerequisite chain: ${cycle.join(" -> ")}`, { courses: cycle });
      return;
    }
    state.set(key, 1);
    stack.push(key);
    const course = coursesByKey.get(key);
    for (const prerequisite of course?.prerequisites ?? []) {
      const prerequisiteKey = courseCodeKey(prerequisite);
      if (coursesByKey.has(prerequisiteKey)) visit(prerequisiteKey);
    }
    stack.pop();
    state.set(key, 2);
  }
  for (const key of coursesByKey.keys()) visit(key);
}

export function resolvePlan(plan, catalog, colors, diagnostics, options = {}) {
  const fallbacks = fallbackMap(plan);
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
    const fallbackProvenance = fallbackRecord?._provenance ?? {};
    const fallbackIsCatalogSnapshot = Object.keys(fallbackProvenance).length > 0
      && Object.values(fallbackProvenance).every((source) => source === "catalog");
    const catalogFacts = entry.forceFallback ? {} : compactFacts(catalog.get(key) ?? {});
    const override = compactFacts(entry.override ?? {});
    const mergedFacts = mergeFacts(fallback, catalogFacts, override, {
      prerequisites: entry.prerequisites,
      corequisites: entry.corequisites,
      minimumCompletedCredits: entry.minimumCompletedCredits,
      requirement: entry.requirement,
      trackSpecific: entry.trackSpecific,
      extinct: entry.extinct,
    });
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
      const manualFields = Object.entries(fallbackProvenance)
        .filter(([, source]) => source === "manual")
        .map(([field]) => field)
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

    const prerequisiteParts = splitRequirements(facts.prerequisites);
    const corequisiteParts = splitRequirements(facts.corequisites);
    let prerequisites = prerequisiteParts.courses;
    let corequisites = corequisiteParts.courses;
    const prerequisiteConditions = Array.from(new Set([
      ...prerequisiteParts.conditions,
      ...corequisiteParts.conditions,
    ]));
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
      minimumCompletedCredits: numericValue(facts.minimumCompletedCredits),
      category,
      subject,
      color,
      requirement: facts.requirement ?? "required",
      isTrackSpecific: Boolean(facts.trackSpecific),
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
    const nameFit = courseNameFit(course.name);
    const requirementLabel = [
      ...course.prerequisites,
      ...course.corequisites.map((value) => `${value} مرافق`),
      ...course.prerequisiteConditions,
      ...(course.minimumCompletedCredits === null ? [] : [`${course.minimumCompletedCredits} ساعة`]),
    ].join(" | ");
    if (nameFit.overflow) {
      addDiagnostic(diagnostics, "warnings", "COURSE_NAME_MINIMUM_SIZE", `${code} remains wider than the course card at the minimum readable size.`, {
        course: code,
        minimumSize: nameFit.size,
        location: context.location,
      });
    }
    if (requirementLabel && prerequisiteFit(requirementLabel, 43).overflow) {
      addDiagnostic(diagnostics, "warnings", "PREREQUISITE_TEXT_MINIMUM_SIZE", `${code} prerequisite text remains wider than the pill at the minimum readable size.`, {
        course: code,
        location: context.location,
      });
    }
    allCourses.push(course);
    if (context.semesterIndex !== null && context.semesterIndex !== undefined) {
      mainCourses.push(course);
      if (!semesterLookup.has(key)) semesterLookup.set(key, context.semesterIndex);
    }
    return course;
  }

  const resolvedSemesters = plan.semesters.map((semester, semesterIndex) => {
    const sameGroupKeys = new Set(semester.courses.map((entry) => courseCodeKey(entry.code)));
    const resolvedCourses = semester.courses.map((entry, entryIndex) => resolveEntry(entry, {
      semesterIndex,
      entryIndex,
      sameGroupKeys,
      location: `semester-${semesterIndex + 1}`,
    }));
    const sortMode = semester.sortCourses ?? plan.sortCourses ?? "code";
    if (sortMode === "code") resolvedCourses.sort((a, b) => compareCourseCodes(a.code, b.code));
    const semesterHours = resolvedCourses.reduce((sum, course) => sum + course.academicHours, 0);
    if (numericValue(semester.expectedCredits) !== null && semesterHours !== numericValue(semester.expectedCredits)) {
      addDiagnostic(diagnostics, "warnings", "SEMESTER_HOURS_MISMATCH", `${semester.name}: calculated ${semesterHours}, expected ${semester.expectedCredits}.`, {
        semester: semesterIndex + 1,
        calculated: semesterHours,
        expected: semester.expectedCredits,
      });
    }
    return {
      id: semester.id ?? `published-level-${semesterIndex + 1}`,
      number: semester.number ?? semesterIndex + 1,
      name: semester.name,
      yearLabel: semester.yearLabel ?? null,
      courseDisplayOrder: semester.courseDisplayOrder ?? (sortMode === "code" ? "rtl" : "ltr"),
      academicHours: semesterHours,
      courses: resolvedCourses,
    };
  });

  const publishedHours = new Map(mainCourses.map((course) => [course.key, course.academicHours]));
  const resolvedElectiveGroups = (plan.electiveGroups ?? []).map((group, groupIndex) => {
    const excluded = [];
    const candidateEntries = (group.courses ?? []).filter((entry) => {
      if (!group.sharedSource) return true;
      const code = normalizeCourseCode(entry.code);
      const key = courseCodeKey(code);
      if (!publishedHours.has(key)) return true;
      if (!excluded.some((item) => item.key === key)) {
        excluded.push({ code, key, academicHours: publishedHours.get(key) ?? 0 });
        addDiagnostic(diagnostics, "info", "ELECTIVE_CANDIDATE_EXCLUDED", `${code} was excluded because it already exists in a published semester.`, {
          course: code,
          sourceId: group.sourceId,
          location: `elective-${group.sourceId}`,
        });
      }
      return false;
    });
    const resolvedCourses = candidateEntries.map((entry, entryIndex) => resolveEntry(entry, {
      semesterIndex: null,
      entryIndex,
      sameGroupKeys: null,
      location: `elective-${group.id ?? groupIndex + 1}`,
    }));
    if ((group.sortCourses ?? "code") === "code") resolvedCourses.sort((a, b) => compareCourseCodes(a.code, b.code));
    const originalRequiredHours = numericValue(group.originalRequiredHours ?? group.requiredHours);
    const excludedHours = excluded.reduce((sum, course) => sum + course.academicHours, 0);
    const effectiveRequiredHours = group.sharedSource
      ? Math.max(0, (originalRequiredHours ?? 0) - excludedHours)
      : numericValue(group.requiredHours);
    const hasHours = effectiveRequiredHours !== null;
    const hasText = Boolean(String(group.requirementText ?? "").trim());
    if (hasHours === hasText) {
      addDiagnostic(diagnostics, "errors", hasHours ? "ELECTIVE_REQUIREMENT_BOTH" : "ELECTIVE_REQUIREMENT_MISSING", `${group.name} must use either required hours or custom requirement text.`, {
        location: `elective-${group.id ?? groupIndex + 1}`,
      });
    }
    return {
      id: group.id ?? `elective-group-${groupIndex + 1}`,
      name: group.name ?? `مجموعة اختيارية ${groupIndex + 1}`,
      sourceId: group.sourceId ?? null,
      sharedSource: Boolean(group.sharedSource),
      originalRequiredHours: group.sharedSource ? originalRequiredHours : null,
      excludedCourses: excluded,
      requiredHours: hasHours && !hasText ? effectiveRequiredHours : null,
      requirementText: hasText && !hasHours ? String(group.requirementText).trim() : null,
      courseDisplayOrder: group.courseDisplayOrder ?? ((group.sortCourses ?? "code") === "code" ? "rtl" : "ltr"),
      courses: resolvedCourses,
    };
  }).filter((group) => !(group.sharedSource && group.requiredHours === 0 && group.courses.length === 0));

  const coursesByKey = new Map();
  for (const course of allCourses) if (!coursesByKey.has(course.key)) coursesByKey.set(course.key, course);
  const parentKeys = new Set();
  for (const course of allCourses) {
    for (const prerequisite of [...course.prerequisites, ...course.corequisites]) {
      const prerequisiteKey = courseCodeKey(prerequisite);
      parentKeys.add(prerequisiteKey);
      if (!coursesByKey.has(prerequisiteKey)) {
        addDiagnostic(diagnostics, "warnings", "PREREQUISITE_NOT_IN_PLAN", `${course.code} refers to ${prerequisite}, which is not present in the plan.`, {
          course: course.code,
          prerequisite,
        });
      } else if (semesterLookup.has(prerequisiteKey) && semesterLookup.has(course.key)) {
        const prerequisiteSemester = semesterLookup.get(prerequisiteKey);
        const courseSemester = semesterLookup.get(course.key);
        if (prerequisiteSemester > courseSemester && course.prerequisites.some((value) => courseCodeKey(value) === prerequisiteKey)) {
          addDiagnostic(diagnostics, "warnings", "PREREQUISITE_AFTER_COURSE", `${prerequisite} is placed after ${course.code}.`, {
            course: course.code,
            prerequisite,
          });
        }
      }
    }
  }
  for (const course of allCourses) course.isParentCourse = parentKeys.has(course.key);
  detectCycles(coursesByKey, diagnostics);

  let cumulative = 0;
  for (const semester of resolvedSemesters) {
    cumulative += semester.academicHours;
    semester.cumulativeHours = cumulative;
  }
  const totalHours = cumulative;
  if (numericValue(plan.expectedCredits) !== null && totalHours !== numericValue(plan.expectedCredits)) {
    addDiagnostic(diagnostics, "warnings", "PLAN_HOURS_MISMATCH", `Calculated plan hours are ${totalHours}, expected ${plan.expectedCredits}.`, {
      calculated: totalHours,
      expected: plan.expectedCredits,
    });
  }

  const result = {
    schemaVersion: 1,
    generatorVersion: "0.2.0",
    id: plan.id ?? null,
    university: plan.university,
    college: plan.college,
    major: plan.major,
    degree: plan.degree,
    planCode: plan.planCode,
    version: plan.version,
    edition: plan.edition ?? options.settings?.edition ?? null,
    release: plan.release ?? options.settings?.release ?? null,
    headerSubtitle: plan.headerSubtitle ?? null,
    phases: plan.phases ?? null,
    footer: plan.footer ?? null,
    expectedCredits: numericValue(plan.expectedCredits),
    totalHours,
    semesterCount: resolvedSemesters.length,
    courseCount: mainCourses.length,
    electiveCourseCount: resolvedElectiveGroups.reduce((sum, group) => sum + group.courses.length, 0),
    semesters: resolvedSemesters,
    electiveGroups: resolvedElectiveGroups,
    proposal: null,
  };

  if (plan.proposal && !options.skipProposal) {
    result.proposal = {
      ...reconcileProposal(result, plan.proposal, diagnostics),
      id: plan.id ? `${plan.id}-proposal` : null,
      university: result.university,
      college: result.college,
      major: result.major,
      degree: result.degree,
      edition: result.edition,
      release: result.release,
      headerSubtitle: plan.major,
    };
  }


  return result;
}
