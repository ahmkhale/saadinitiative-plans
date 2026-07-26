import { courseCodeKey, normalizeCourseCode, numericValue } from "./normalize.mjs";
import { labelSemesters } from "./semester-labels.mjs";

function occurrenceSlug(code) {
  return courseCodeKey(code).replace(/\s+/gu, "-");
}

function normalizeRuleList(values = []) {
  return Array.from(new Set(values.map(normalizeCourseCode).filter(Boolean)));
}

function canonicalFallbackCourses(value = {}) {
  return Object.fromEntries(Object.entries(value).map(([rawCode, facts = {}]) => {
    const code = normalizeCourseCode(rawCode);
    const source = facts.source === "catalog" ? "catalog" : "manual";
    const presentFields = ["name", "academicHours", "lectureHours", "exerciseHours", "practicalHours"]
      .filter((field) => facts[field] !== undefined && facts[field] !== null && facts[field] !== "");
    return [code, {
      name: facts.name ?? null,
      academicHours: numericValue(facts.academicHours),
      lectureHours: numericValue(facts.lectureHours),
      exerciseHours: numericValue(facts.exerciseHours),
      practicalHours: numericValue(facts.practicalHours),
      source,
      manuallyEditedFields: source === "manual"
        ? Array.from(new Set(facts.manuallyEditedFields ?? presentFields))
        : Array.from(new Set(facts.manuallyEditedFields ?? [])),
    }];
  }));
}

function canonicalCourseEntry(rawEntry, occurrencePrefix) {
  const entry = typeof rawEntry === "string" ? { code: rawEntry } : structuredClone(rawEntry ?? {});
  const code = normalizeCourseCode(entry.code);
  return {
    id: entry.id ?? `${occurrencePrefix}:${occurrenceSlug(code)}`,
    code,
    prerequisites: normalizeRuleList(entry.prerequisites ?? []),
    corequisites: normalizeRuleList(entry.corequisites ?? []),
    minimumCompletedCredits: numericValue(entry.minimumCompletedCredits),
    prerequisiteConditions: Array.from(new Set(
      (entry.prerequisiteConditions ?? []).map((value) => String(value).trim()).filter(Boolean),
    )),
    trackSpecific: Boolean(entry.trackSpecific),
    ...(entry.extinct ? { extinct: true } : {}),
    ...(entry.forceFallback ? { forceFallback: true } : {}),
    ...(entry.preserveSameSemesterPrerequisite ? { preserveSameSemesterPrerequisite: true } : {}),
  };
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
    prerequisites: normalizeRuleList(entry.prerequisites ?? []),
    corequisites: normalizeRuleList(entry.corequisites ?? []),
    prerequisiteConditions: Array.from(new Set(entry.prerequisiteConditions ?? [])),
  };
  return normalized;
}

function normalizeElectiveGroups(groups = [], planId = "plan") {
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
    courses: (group.courses ?? []).map((entry) => {
      const course = normalizeStandaloneCourse(entry);
      return {
        ...course,
        id: course.id ?? `major:${planId}:elective:${group.id ?? `elective-group-${index + 1}`}:${occurrenceSlug(course.code)}`,
      };
    }),
  }));
}

function normalizeSemesters(semesters = [], planId = "plan") {
  return labelSemesters(semesters.map((semester, index) => ({
    ...semester,
    id: semester.id ?? `published-level-${index + 1}`,
    courses: (semester.courses ?? []).map((entry) => {
      const course = normalizeStandaloneCourse(entry);
      const semesterId = semester.id ?? `published-level-${index + 1}`;
      return {
        ...course,
        id: course.id ?? `major:${planId}:${semesterId}:${occurrenceSlug(course.code)}`,
      };
    }),
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
      courseOrder: (semester.courseOrder ?? []).map((value) => String(value ?? "").trim()).filter(Boolean),
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
  return canonicalizePlanForStorage(rawPlan);
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
  delete plan.university;
  delete plan.college;
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
    value.courses = (value.courses ?? []).map((entry) => canonicalCourseEntry(
      entry,
      `major:${plan.id}:${value.id}`,
    ));
    return value;
  });
  plan.electiveGroups = (plan.electiveGroups ?? []).map((group) => group?.sourceId ? group : ({
    ...group,
    courses: (group.courses ?? []).map((entry) => canonicalCourseEntry(
      entry,
      `major:${plan.id}:elective:${group.id}`,
    )),
  }));
  plan.fallbackCourses = canonicalFallbackCourses(plan.fallbackCourses);
  if (plan.proposal) plan.proposal = normalizeProposal(plan.proposal);
  return plan;
}

export function normalizePlanInput(raw) {
  const value = raw;

  if (!value || typeof value !== "object") throw new Error("Plan JSON must be an object.");
  if (Array.isArray(value) || Array.isArray(value.plans)) {
    throw new Error("Plan JSON must use the canonical single-plan object shape.");
  }

  const planId = value.id ?? "plan";
  const semesters = normalizeSemesters(value.semesters ?? [], planId);

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
    fallbackCourses: canonicalFallbackCourses(value.fallbackCourses),
    phases: value.phases,
    sharedSemesterSets: value.sharedSemesterSets ?? [],
    footer: value.footer,
    semesters,
    electiveGroups: normalizeElectiveGroups(value.electiveGroups ?? [], planId),
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
