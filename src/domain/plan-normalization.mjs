import { courseCodeKey, normalizeCourseCode, numericValue } from "./course-code.mjs";
import { normalizeActivityTypes } from "./course-facts.mjs";
import { normalizeRequirementAlternatives } from "./course-requirements.mjs";
import { labelSemesters } from "./semester.mjs";

export function occurrenceSlug(code) {
  return courseCodeKey(code).replace(/\s+/gu, "-");
}

export function normalizeRuleList(values = []) {
  return Array.from(new Set(values.map(normalizeCourseCode).filter(Boolean)));
}

export function canonicalFallbackCourses(value = {}) {
  const result = {};
  const keys = new Set();
  for (const [rawCode, facts = {}] of Object.entries(value)) {
    const code = normalizeCourseCode(rawCode);
    const key = courseCodeKey(code);
    if (keys.has(key)) throw new Error(`Fallback course code appears more than once after normalization: ${code}`);
    keys.add(key);
    const source = facts.source === "catalog" ? "catalog" : "manual";
    const presentFields = ["name", "academicHours", "lectureHours", "exerciseHours", "practicalHours"]
      .filter((field) => facts[field] !== undefined && facts[field] !== null && facts[field] !== "");
    const activityTypes = normalizeActivityTypes(facts.activityTypes);
    result[code] = {
      name: facts.name ?? null,
      academicHours: numericValue(facts.academicHours),
      lectureHours: numericValue(facts.lectureHours),
      exerciseHours: numericValue(facts.exerciseHours),
      practicalHours: numericValue(facts.practicalHours),
      ...(activityTypes.length ? { activityTypes } : {}),
      source,
      manuallyEditedFields: source === "manual"
        ? Array.from(new Set(facts.manuallyEditedFields ?? presentFields))
        : Array.from(new Set(facts.manuallyEditedFields ?? [])),
    };
  }
  return result;
}

export function canonicalCourseEntry(rawEntry, occurrencePrefix) {
  const entry = typeof rawEntry === "string" ? { code: rawEntry } : structuredClone(rawEntry ?? {});
  const code = normalizeCourseCode(entry.code);
  const forcedCorequisites = normalizeRuleList(entry.forcedCorequisites ?? []);
  const prerequisiteAlternatives = normalizeRequirementAlternatives(entry.prerequisiteAlternatives);
  return {
    id: entry.id ?? `${occurrencePrefix}:${occurrenceSlug(code)}`,
    code,
    prerequisites: normalizeRuleList(entry.prerequisites ?? []),
    corequisites: normalizeRuleList(entry.corequisites ?? []),
    ...(forcedCorequisites.length ? { forcedCorequisites } : {}),
    ...(prerequisiteAlternatives.length ? { prerequisiteAlternatives } : {}),
    minimumCompletedCredits: numericValue(entry.minimumCompletedCredits),
    prerequisiteConditions: Array.from(new Set(
      (entry.prerequisiteConditions ?? []).map((value) => String(value).trim()).filter(Boolean),
    )),
    ...(entry.extinct ? { extinct: true } : {}),
    ...(entry.forceFallback ? { forceFallback: true } : {}),
    ...(entry.preserveSameSemesterPrerequisite ? { preserveSameSemesterPrerequisite: true } : {}),
  };
}

export function normalizeStandaloneCourse(entry) {
  if (typeof entry === "string") return { code: normalizeCourseCode(entry) };
  if (!entry || typeof entry !== "object") throw new Error("Every course must be a code string or object.");
  if (entry.kind === "placeholder") {
    throw new Error("Placeholder courses are valid only in proposal.semesters[].placeholders.");
  }
  return {
    ...entry,
    code: normalizeCourseCode(entry.code),
    prerequisites: normalizeRuleList(entry.prerequisites ?? []),
    corequisites: normalizeRuleList(entry.corequisites ?? []),
    forcedCorequisites: normalizeRuleList(entry.forcedCorequisites ?? []),
    prerequisiteAlternatives: normalizeRequirementAlternatives(entry.prerequisiteAlternatives),
    prerequisiteConditions: Array.from(new Set(entry.prerequisiteConditions ?? [])),
  };
}

export function normalizeElectiveGroups(groups = [], planId = "plan") {
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

export function normalizeSemesters(semesters = [], planId = "plan") {
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

export function normalizeProposal(proposal) {
  if (!proposal || typeof proposal !== "object") return null;
  for (const obsolete of ["includeGuide", "showGuide", "expectedCredits", "phases"]) {
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
    semesters,
  };
}

export function stripDerivedSemesterFields(semester) {
  const value = structuredClone(semester ?? {});
  delete value.number;
  delete value.name;
  delete value.yearLabel;
  return value;
}
