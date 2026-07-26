import { addDiagnostic } from "./diagnostics.mjs";
import { compareCourseCodes, courseCodeKey, courseSubject, normalizeCourseCode, numericValue, toWesternDigits } from "./normalize.mjs";

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
  const alternateAcademicHours = value.creditHours ?? value.fallbackCreditHours;
  if (facts.academicHours === undefined && alternateAcademicHours !== undefined && alternateAcademicHours !== null && alternateAcademicHours !== "") facts.academicHours = alternateAcademicHours;
  if (facts.practicalHours === undefined && value.labHours !== undefined && value.labHours !== null && value.labHours !== "") facts.practicalHours = value.labHours;
  const alternateExerciseHours = value.tutorialHours ?? value.discussionHours;
  if (facts.exerciseHours === undefined && alternateExerciseHours !== undefined && alternateExerciseHours !== null && alternateExerciseHours !== "") facts.exerciseHours = alternateExerciseHours;
  if (facts.name === undefined && value.fallbackName !== undefined && value.fallbackName !== null && value.fallbackName !== "") facts.name = value.fallbackName;
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
    map.set(courseCodeKey(code), { code: normalizeCourseCode(code), ...compactFacts(facts), source: "plan-fallback" });
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
    const isPlaceholder = entry.kind === "placeholder";
    const key = isPlaceholder
      ? `__placeholder__${context.location}-${context.entryIndex ?? 0}`
      : courseCodeKey(code);
    if (!isPlaceholder) {
      if (seen.has(key)) {
        addDiagnostic(diagnostics, "errors", "DUPLICATE_COURSE", `${code} appears more than once in the plan.`, {
          course: code,
          firstLocation: seen.get(key),
          location: context.location,
        });
      } else {
        seen.set(key, context.location);
      }
    }

    const fallback = mergeFacts(isPlaceholder ? {} : (fallbacks.get(key) ?? {}), entry.fallback ?? {});
    const catalogFacts = isPlaceholder || entry.forceFallback ? {} : compactFacts(catalog.get(key) ?? {});
    const override = compactFacts(entry.override ?? {});
    const facts = mergeFacts(fallback, catalogFacts, override, {
      prerequisites: entry.prerequisites,
      corequisites: entry.corequisites,
      minimumCompletedCredits: entry.minimumCompletedCredits,
      requirement: entry.requirement,
      trackSpecific: entry.trackSpecific,
      extinct: entry.extinct,
    });
    const usedCatalog = Object.keys(catalogFacts).length > 0;
    const usedFallback = !usedCatalog && Object.keys(fallback).length > 0;

    const manualMissing = usedFallback && !isPlaceholder
      ? ["name", "academicHours", "lectureHours", "exerciseHours", "practicalHours"]
        .filter((field) => field === "name" ? !facts.name : numericValue(facts[field]) === null)
      : [];
    if (!facts.name || numericValue(facts.academicHours) === null) {
      addDiagnostic(diagnostics, "errors", "UNRESOLVED_COURSE", `${code} is missing required facts in both courses.json and plan fallback.`, {
        course: code,
        missing: [!facts.name ? "name" : null, numericValue(facts.academicHours) === null ? "academicHours" : null].filter(Boolean),
        location: context.location,
      });
    } else if (manualMissing.length) {
      addDiagnostic(diagnostics, "errors", "INCOMPLETE_MANUAL_COURSE", `${code} has incomplete manual course facts.`, {
        course: code,
        missing: manualMissing,
        location: context.location,
      });
    } else if (usedFallback && !isPlaceholder) {
      addDiagnostic(diagnostics, "info", "FALLBACK_USED", `${code} was not found in courses.json; plan fallback was used.`, { course: code });
    }
    const rawCatalog = catalog.get(key);
    if (rawCatalog?.conflicts?.length) {
      addDiagnostic(diagnostics, "warnings", "CONFLICTING_CATALOG_FACTS", `${code} has conflicting section-derived facts that need review.`, {
        course: code,
        conflicts: rawCatalog.conflicts,
        location: context.location,
      });
    }
    if (usedCatalog && fallbacks.has(key)) {
      addDiagnostic(diagnostics, "info", "MANUAL_CATALOG_AVAILABLE", `${code} now exists in the section data; the manual definition was preserved for comparison.`, {
        course: code,
        location: context.location,
      });
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
    if (!isPlaceholder && !facts.color && !plan.courseColors?.[subject] && !colors[subject] && !colors[category]) {
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
      isPlaceholder,
      isMissingFromCatalog: !usedCatalog,
      source: usedCatalog ? "catalog" : usedFallback ? "fallback" : "unresolved",
      catalogSource: usedCatalog ? rawCatalog?.catalogSource ?? "catalog" : usedFallback ? "manual" : null,
      sourceBadge: rawCatalog?.conflicts?.length
        ? "بيانات متعارضة"
        : usedCatalog && [facts.lectureHours, facts.exerciseHours, facts.practicalHours].some((value) => numericValue(value) === null)
          ? "بيانات ناقصة"
          : usedCatalog
            ? rawCatalog?.catalogSource === "female" ? "دليل الطالبات" : rawCatalog?.catalogSource === "male" ? "دليل الطلاب" : "دليل المقررات"
            : usedFallback ? "مدخل يدويًا" : "بيانات ناقصة",
      location: context.location,
    };
    if (Array.from(course.name).length > 44) {
      addDiagnostic(
        diagnostics,
        "warnings",
        "COURSE_NAME_OVERFLOW",
        `${code} has a course name longer than the fixed Figma card can display.`,
        { course: code, location: context.location, characterCount: Array.from(course.name).length },
      );
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
    if (resolvedCourses.length > 6) {
      addDiagnostic(
        diagnostics,
        "errors",
        "SEMESTER_CARD_OVERFLOW",
        `${semester.name}: ${resolvedCourses.length} courses exceed the six-card Figma row.`,
        { semester: semesterIndex + 1, courseCount: resolvedCourses.length, maximum: 6 },
      );
    }
    const semesterHours = resolvedCourses.reduce((sum, course) => sum + course.academicHours, 0);
    if (numericValue(semester.expectedCredits) !== null && semesterHours !== numericValue(semester.expectedCredits)) {
      addDiagnostic(diagnostics, "warnings", "SEMESTER_HOURS_MISMATCH", `${semester.name}: calculated ${semesterHours}, expected ${semester.expectedCredits}.`, {
        semester: semesterIndex + 1,
        calculated: semesterHours,
        expected: semester.expectedCredits,
      });
    }
    return {
      number: semester.number ?? semesterIndex + 1,
      name: semester.name,
      yearLabel: semester.yearLabel ?? null,
      academicHours: semesterHours,
      courses: resolvedCourses,
    };
  });

  const resolvedElectiveGroups = (plan.electiveGroups ?? []).map((group, groupIndex) => {
    const resolvedCourses = group.courses.map((entry, entryIndex) => resolveEntry(entry, {
      semesterIndex: null,
      entryIndex,
      sameGroupKeys: null,
      location: `elective-${group.id ?? groupIndex + 1}`,
    }));
    if ((group.sortCourses ?? "code") === "code") resolvedCourses.sort((a, b) => compareCourseCodes(a.code, b.code));
    const hasHours = numericValue(group.requiredHours) !== null;
    const hasText = Boolean(String(group.requirementText ?? "").trim());
    if (hasHours === hasText) {
      addDiagnostic(diagnostics, "errors", hasHours ? "ELECTIVE_REQUIREMENT_BOTH" : "ELECTIVE_REQUIREMENT_MISSING", `${group.name} must use either required hours or custom requirement text.`, {
        location: `elective-${group.id ?? groupIndex + 1}`,
      });
    }
    return {
      id: group.id ?? `elective-group-${groupIndex + 1}`,
      name: group.name ?? `مجموعة اختيارية ${groupIndex + 1}`,
      requiredHours: hasHours && !hasText ? numericValue(group.requiredHours) : null,
      requirementText: hasText && !hasHours ? String(group.requirementText).trim() : null,
      courses: resolvedCourses,
    };
  });

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
    const publishedEntries = new Map();
    for (const semester of plan.semesters) {
      for (const entry of semester.courses) publishedEntries.set(courseCodeKey(entry.code), entry);
    }
    const proposalOccurrences = new Map();
    const proposalSemesters = plan.proposal.semesters.map((semester, semesterIndex) => {
      const realEntries = [];
      for (const code of semester.courseOrder ?? []) {
        const normalizedCode = normalizeCourseCode(code);
        const key = courseCodeKey(normalizedCode);
        proposalOccurrences.set(key, (proposalOccurrences.get(key) ?? 0) + 1);
        const published = publishedEntries.get(key);
        if (!published) {
          addDiagnostic(diagnostics, "errors", "PROPOSAL_UNKNOWN_REAL_COURSE", `${normalizedCode} is not a published-plan course.`, {
            course: normalizedCode,
            location: `proposal-semester-${semesterIndex + 1}`,
          });
          realEntries.push({ code: normalizedCode });
        } else {
          realEntries.push(structuredClone(published));
        }
      }
      const placeholders = (semester.placeholders ?? []).map((placeholder, placeholderIndex) => ({
        kind: "placeholder",
        code: `مقرر ${placeholder.id ?? `${semesterIndex + 1}-${placeholderIndex + 1}`}`,
        fallback: {
          name: placeholder.name,
          academicHours: placeholder.academicHours,
          lectureHours: placeholder.lectureHours,
          exerciseHours: placeholder.exerciseHours,
          practicalHours: placeholder.practicalHours,
          color: placeholder.color ?? "#000000",
        },
      }));
      return {
        ...semester,
        sortCourses: "input",
        courses: [...realEntries, ...placeholders],
      };
    });
    for (const [key, entry] of publishedEntries) {
      const count = proposalOccurrences.get(key) ?? 0;
      if (count === 0) {
        addDiagnostic(diagnostics, "errors", "PROPOSAL_MISSING_REAL_COURSE", `${entry.code} is missing from the proposed plan.`, { course: entry.code });
      } else if (count > 1) {
        addDiagnostic(diagnostics, "errors", "PROPOSAL_DUPLICATE_REAL_COURSE", `${entry.code} appears more than once in the proposed plan.`, { course: entry.code, count });
      }
    }
    const proposalPlan = {
      ...plan,
      id: plan.id ? `${plan.id}-proposal` : null,
      expectedCredits: plan.proposal.expectedCredits,
      phases: plan.proposal.phases ?? plan.phases,
      semesters: proposalSemesters,
      electiveGroups: [],
      proposal: null,
    };
    const resolvedProposal = resolvePlan(proposalPlan, catalog, colors, diagnostics, { ...options, skipProposal: true });
    result.proposal = {
      ...resolvedProposal,
      title: plan.proposal.title ?? "الخطة المقترحة",
      headerSubtitle: plan.major,
      phases: plan.proposal.phases ?? resolvedProposal.phases,
    };
  }

  return result;
}
