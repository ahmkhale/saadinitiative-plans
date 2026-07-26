import { normalizeCourseCode, numericValue } from "./normalize.mjs";
import { labelSemesters } from "./semester-labels.mjs";

const INLINE_FALLBACK_FIELDS = Object.freeze({
  name: "fallbackName",
  academicHours: "fallbackCreditHours",
  lectureHours: "fallbackLectureHours",
  exerciseHours: "fallbackExerciseHours",
  practicalHours: "fallbackPracticalHours",
});

function inlineFallbackFacts(entry = {}) {
  const facts = {};
  for (const [factField, inlineField] of Object.entries(INLINE_FALLBACK_FIELDS)) {
    if (entry[inlineField] !== undefined) facts[factField] = entry[inlineField];
  }
  if (entry.fallbackProvenance) facts._provenance = structuredClone(entry.fallbackProvenance);
  return facts;
}

function ownedCourseEntries(plan) {
  return [
    ...(plan.semesters ?? []).flatMap((semester) => semester.courses ?? []),
    ...(plan.electiveGroups ?? [])
      .filter((group) => !group.sourceId)
      .flatMap((group) => group.courses ?? []),
  ];
}

function editorFallbackCourses(plan) {
  const fallbacks = structuredClone(plan.fallbackCourses ?? {});
  for (const rawEntry of ownedCourseEntries(plan)) {
    const entry = typeof rawEntry === "string" ? { code: rawEntry } : rawEntry;
    const code = normalizeCourseCode(entry?.code);
    if (!code) continue;
    const facts = inlineFallbackFacts(entry);
    if (Object.keys(facts).length) fallbacks[code] = { ...facts, ...(fallbacks[code] ?? {}) };
  }
  return fallbacks;
}

function canonicalCourseEntry(rawEntry, fallbackCourses, defaultRequirement) {
  const entry = typeof rawEntry === "string" ? { code: rawEntry } : structuredClone(rawEntry ?? {});
  const code = normalizeCourseCode(entry.code);
  const fallback = {
    ...inlineFallbackFacts(entry),
    ...(entry.fallback ?? {}),
    ...(fallbackCourses?.[code] ?? {}),
  };
  const value = { ...entry, code };
  delete value.fallback;
  delete value.override;
  for (const inlineField of Object.values(INLINE_FALLBACK_FIELDS)) delete value[inlineField];
  delete value.fallbackProvenance;
  for (const [factField, inlineField] of Object.entries(INLINE_FALLBACK_FIELDS)) {
    value[inlineField] = fallback[factField] ?? null;
  }
  value.prerequisites = structuredClone(
    entry.prerequisites ?? entry.override?.prerequisites ?? fallback.prerequisites ?? [],
  );
  if (entry.corequisites !== undefined || entry.override?.corequisites !== undefined || fallback.corequisites !== undefined) {
    value.corequisites = structuredClone(entry.corequisites ?? entry.override?.corequisites ?? fallback.corequisites ?? []);
  }
  value.requirement = entry.requirement ?? fallback.requirement ?? defaultRequirement;
  value.trackSpecific = Boolean(entry.trackSpecific ?? fallback.trackSpecific ?? false);
  if (fallback._provenance) value.fallbackProvenance = structuredClone(fallback._provenance);
  return value;
}

function normalizeStandaloneCourse(entry) {
  if (typeof entry === "string") return { code: normalizeCourseCode(entry) };
  if (!entry || typeof entry !== "object") throw new Error("Every course must be a code string or object.");
  if (entry.kind === "placeholder") {
    throw new Error("Placeholder courses are valid only in proposal.semesters[].placeholders.");
  }
  const normalized = {
    ...entry,
    code: normalizeCourseCode(entry.code),
  };
  return normalized;
}

function normalizeElectiveGroups(groups = []) {
  return groups.map((group, index) => group?.sourceId ? {
    sourceId: group.sourceId,
  } : ({
    ...group,
    id: group.id ?? `elective-group-${index + 1}`,
    name: group.name ?? `مجموعة اختيارية ${index + 1}`,
    requiredHours: group.requirementText === undefined
      ? group.requiredHours ?? 0
      : undefined,
    requirementText: group.requirementText,
    sortCourses: group.sortCourses ?? "code",
    courses: (group.courses ?? []).map(normalizeStandaloneCourse),
  }));
}

function normalizeSemesters(semesters = []) {
  return labelSemesters(semesters.map((semester, index) => ({
    ...semester,
    id: semester.id ?? `published-level-${index + 1}`,
    courses: (semester.courses ?? []).map(normalizeStandaloneCourse),
  })));
}

function normalizeProposal(proposal) {
  if (!proposal || typeof proposal !== "object") return null;
  for (const obsolete of ["includeGuide", "expectedCredits", "phases"]) {
    if (proposal[obsolete] !== undefined) throw new Error(`proposal.${obsolete} is not part of the canonical proposal model.`);
  }
  const semesters = (proposal.semesters ?? []).map((semester, index) => {
    if (semester.courses !== undefined) {
      throw new Error(`proposal.semesters[${index}].courses is obsolete; use courseOrder references.`);
    }
    const placeholders = Array.isArray(semester.placeholders) ? semester.placeholders : [];
    return {
      id: semester.id ?? `level-${index + 1}`,
      sourceSemesterId: semester.sourceSemesterId ?? null,
      type: semester.type === "summer" ? "summer" : "regular",
      courseOrder: (semester.courseOrder ?? []).map(normalizeCourseCode),
      placeholders: placeholders.map((placeholder, placeholderIndex) => ({
        ...placeholder,
        id: placeholder.id ?? `placeholder-${index + 1}-${placeholderIndex + 1}`,
      })),
    };
  });
  return {
    enabled: proposal.enabled !== false,
    title: proposal.title ?? "الخطة المقترحة",
    showGuide: proposal.showGuide !== false,
    semesters,
  };
}

export function preparePlanForEditor(rawPlan) {
  const plan = canonicalizePlanForStorage(rawPlan);
  plan.fallbackCourses = editorFallbackCourses(plan);
  return plan;
}

function stripDerivedSemesterFields(semester) {
  const value = structuredClone(semester ?? {});
  delete value.number;
  delete value.name;
  delete value.yearLabel;
  return value;
}

/**
 * Keep persisted plan files limited to operator-owned decisions.
 *
 * Semester names/numbers are presentation facts derived from their final
 * position after shared levels are composed. Proposal real-course facts are
 * derived from the published plan; only placement references and placeholders
 * are persisted.
 */
export function canonicalizePlanForStorage(rawPlan) {
  const plan = structuredClone(rawPlan ?? {});
  const fallbackCourses = editorFallbackCourses(plan);
  delete plan.version;
  delete plan.edition;
  delete plan.release;
  const usedSemesterIds = new Set((plan.semesters ?? []).map((semester) => semester?.id).filter(Boolean));
  let nextSemesterNumber = 1;
  plan.semesters = (plan.semesters ?? []).map((semester) => {
    const value = stripDerivedSemesterFields(semester);
    if (!value.id) {
      while (usedSemesterIds.has(`published-level-${nextSemesterNumber}`)) nextSemesterNumber += 1;
      value.id = `published-level-${nextSemesterNumber}`;
      usedSemesterIds.add(value.id);
      nextSemesterNumber += 1;
    }
    value.courses = (value.courses ?? []).map((entry) => canonicalCourseEntry(entry, fallbackCourses, "required"));
    return value;
  });
  plan.electiveGroups = (plan.electiveGroups ?? []).map((group) => group?.sourceId ? group : ({
    ...group,
    courses: (group.courses ?? []).map((entry) => canonicalCourseEntry(entry, fallbackCourses, "elective")),
  }));
  delete plan.fallbackCourses;
  if (plan.proposal) plan.proposal = normalizeProposal(plan.proposal);
  return plan;
}

export function normalizePlanInput(raw) {
  const value = raw;

  if (!value || typeof value !== "object") throw new Error("Plan JSON must be an object.");
  if (Array.isArray(value) || Array.isArray(value.plans)) {
    throw new Error("Plan JSON must use the canonical single-plan object shape.");
  }

  const semesters = normalizeSemesters(value.semesters ?? []);

  return {
    schemaVersion: value.schemaVersion ?? 1,
    id: value.id,
    university: value.university ?? "جامعة الملك سعود",
    college: value.college ?? "",
    major: value.major,
    degree: value.degree ?? "البكالوريوس",
    planCode: value.planCode ?? "",
    version: value.version ?? "",
    edition: value.edition,
    release: value.release,
    headerSubtitle: value.headerSubtitle,
    expectedCredits: value.expectedCredits,
    sortCourses: value.sortCourses ?? "code",
    courseColors: value.courseColors ?? {},
    fallbackCourses: editorFallbackCourses(value),
    phases: value.phases,
    sharedSemesterSets: value.sharedSemesterSets ?? [],
    footer: value.footer,
    semesters,
    electiveGroups: normalizeElectiveGroups(value.electiveGroups ?? []),
    proposal: normalizeProposal(value.proposal),
  };
}

export function validatePlanShape(plan) {
  const errors = [];
  if (plan.schemaVersion !== 1) errors.push("schemaVersion must be 1.");
  if (!String(plan.major ?? "").trim()) errors.push("major is required.");
  if (!Array.isArray(plan.semesters) || plan.semesters.length === 0) errors.push("semesters must contain at least one semester.");
  for (const [index, semester] of (plan.semesters ?? []).entries()) {
    if (!Array.isArray(semester.courses)) errors.push(`semesters[${index}].courses must be an array.`);
    for (const [courseIndex, course] of (semester.courses ?? []).entries()) {
      if (!course.code) errors.push(`semesters[${index}].courses[${courseIndex}] has no code.`);
    }
  }
  for (const [groupIndex, group] of (plan.electiveGroups ?? []).entries()) {
    if (group.sourceId) continue;
    if (!Array.isArray(group.courses)) errors.push(`electiveGroups[${groupIndex}].courses must be an array.`);
    for (const [courseIndex, course] of (group.courses ?? []).entries()) {
      if (!course.code) errors.push(`electiveGroups[${groupIndex}].courses[${courseIndex}] has no code.`);
    }
    const hasHours = numericValue(group.requiredHours) !== null;
    const hasText = Boolean(String(group.requirementText ?? "").trim());
    if (hasHours === hasText) errors.push(`electiveGroups[${groupIndex}] must define exactly one of requiredHours or requirementText.`);
  }
  if (plan.proposal) {
    if (!Array.isArray(plan.proposal.semesters)) errors.push("proposal.semesters must be an array.");
    for (const [semesterIndex, semester] of (plan.proposal.semesters ?? []).entries()) {
      if (!Array.isArray(semester.placeholders)) errors.push(`proposal.semesters[${semesterIndex}].placeholders must be an array.`);
      if (!Array.isArray(semester.courseOrder)) errors.push(`proposal.semesters[${semesterIndex}].courseOrder must be an array.`);
    }
  }
  if (errors.length) throw new Error(`Invalid plan:\n- ${errors.join("\n- ")}`);
}
