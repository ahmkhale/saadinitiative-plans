import { courseCodeKey, normalizeCourseCode, numericValue } from "./course-code.mjs";

export function normalizeRequirementRules(entry = {}) {
  return {
    prerequisites: Array.from(new Set((entry.prerequisites ?? []).map(normalizeCourseCode).filter(Boolean))),
    corequisites: Array.from(new Set((entry.corequisites ?? []).map(normalizeCourseCode).filter(Boolean))),
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
  const seen = new Set();

  for (const value of requirements) {
    const code = normalizeCourseCode(value);
    const key = courseCodeKey(code);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    (sameLevelKeys.has(key) ? corequisites : prerequisites).push(code);
  }

  return { prerequisites, corequisites };
}

export function formatCourseRequirementLabel(course = {}) {
  const parts = [
    ...(course.prerequisites ?? []),
    ...(course.corequisites ?? []).map((value) => `${value} مرافق`),
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
      for (const prerequisite of course.prerequisites ?? []) {
        const prerequisiteKey = courseCodeKey(prerequisite);
        const prerequisiteSemester = semesterByKey.get(prerequisiteKey);
        if (prerequisiteSemester !== undefined && prerequisiteSemester < semesterIndex) {
          parentKeys.add(prerequisiteKey);
        }
      }
    }
  }
  return parentKeys;
}
