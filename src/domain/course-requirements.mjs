import { courseCodeKey, normalizeCourseCode, numericValue } from "./course-code.mjs";

export function normalizeRequirementAlternatives(groups = []) {
  const seenGroups = new Set();
  const result = [];
  for (const group of groups ?? []) {
    const alternatives = Array.from(new Set(
      (Array.isArray(group) ? group : [group]).map(normalizeCourseCode).filter(Boolean),
    ));
    if (alternatives.length < 2) continue;
    const identity = alternatives.map(courseCodeKey).sort().join("|");
    if (seenGroups.has(identity)) continue;
    seenGroups.add(identity);
    result.push(alternatives);
  }
  return result;
}

export function normalizeRequirementRules(entry = {}) {
  return {
    prerequisites: Array.from(new Set((entry.prerequisites ?? []).map(normalizeCourseCode).filter(Boolean))),
    corequisites: Array.from(new Set((entry.corequisites ?? []).map(normalizeCourseCode).filter(Boolean))),
    forcedCorequisites: Array.from(new Set((entry.forcedCorequisites ?? []).map(normalizeCourseCode).filter(Boolean))),
    prerequisiteAlternatives: normalizeRequirementAlternatives(entry.prerequisiteAlternatives),
    minimumCompletedCredits: numericValue(entry.minimumCompletedCredits),
    prerequisiteConditions: Array.from(new Set(
      (entry.prerequisiteConditions ?? []).map((value) => String(value).trim()).filter(Boolean),
    )),
  };
}

export function classifyRequirementCourses(requirements = [], sameLevelCourses = []) {
  const sameLevelKeys = new Set(sameLevelCourses.map((course) => (
    courseCodeKey(typeof course === "string" ? course : course?.code)
  )).filter(Boolean));
  const prerequisites = [];
  const corequisites = [];
  const forcedCorequisites = [];
  const prerequisiteAlternatives = [];
  const seen = new Set();

  for (const value of requirements) {
    const alternatives = String(value ?? "").split("^").map((item) => normalizeCourseCode(item.replace(/^\s*#\s*/u, ""))).filter(Boolean);
    if (alternatives.length > 1) {
      const uniqueAlternatives = alternatives.filter((code, index) => (
        alternatives.findIndex((candidate) => courseCodeKey(candidate) === courseCodeKey(code)) === index
      ));
      if (uniqueAlternatives.length > 1) prerequisiteAlternatives.push(uniqueAlternatives);
      continue;
    }
    const forced = /^\s*#/u.test(String(value ?? ""));
    const code = alternatives[0] ?? "";
    const key = courseCodeKey(code);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (forced || sameLevelKeys.has(key)) {
      corequisites.push(code);
      if (forced) forcedCorequisites.push(code);
    } else {
      prerequisites.push(code);
    }
  }

  return { prerequisites, corequisites, forcedCorequisites, prerequisiteAlternatives };
}

export function formatCourseRequirementLabel(course = {}) {
  const parts = [
    ...(course.prerequisites ?? []),
    ...(course.corequisites ?? []).map((value) => `${value} مرافق`),
    ...(course.prerequisiteAlternatives ?? []).map((values) => values.join(" أو ")),
    ...(course.prerequisiteConditions ?? []),
  ];
  if (course.minimumCompletedCredits !== null && course.minimumCompletedCredits !== undefined) {
    parts.push(`إتمام ${course.minimumCompletedCredits} ساعة`);
  }
  return parts.join(" | ");
}

export function derivePublishedParentKeys(semesters = []) {
  const semesterByKey = new Map();
  for (const [semesterIndex, semester] of semesters.entries()) {
    for (const course of semester.courses ?? []) {
      const key = courseCodeKey(course.code);
      if (!semesterByKey.has(key)) semesterByKey.set(key, semesterIndex);
    }
  }

  const parentKeys = new Set();
  for (const [semesterIndex, semester] of semesters.entries()) {
    for (const course of semester.courses ?? []) {
      const courseKey = courseCodeKey(course.code);
      const requirements = [
        ...(course.prerequisites ?? []),
        ...(course.corequisites ?? []),
        ...(course.prerequisiteAlternatives ?? []).flat(),
      ];
      for (const requirement of requirements) {
        const requirementKey = courseCodeKey(requirement);
        const requirementSemester = semesterByKey.get(requirementKey);
        if (
          requirementKey !== courseKey
          && requirementSemester !== undefined
          && requirementSemester <= semesterIndex
        ) {
          parentKeys.add(requirementKey);
        }
      }
    }
  }
  return parentKeys;
}
