import { addDiagnostic } from "../domain/diagnostics.mjs";
import { courseCodeKey } from "../domain/course-code.mjs";
import { derivePublishedParentKeys } from "../domain/course-requirements.mjs";

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

export function validatePublishedCourseGraph({ resolver, resolvedSemesters, resolvedElectiveGroups, diagnostics }) {
  const coursesByKey = new Map();
  for (const course of resolver.mainCourses) if (!coursesByKey.has(course.key)) coursesByKey.set(course.key, course);
  for (const course of resolver.mainCourses) {
    for (const prerequisite of course.prerequisites) {
      const prerequisiteKey = courseCodeKey(prerequisite);
      if (!coursesByKey.has(prerequisiteKey)) {
        addDiagnostic(diagnostics, "warnings", "PREREQUISITE_NOT_IN_PLAN", `${course.code} refers to ${prerequisite}, which is not present in the plan.`, {
          course: course.code,
          prerequisite,
        });
      } else if (resolver.semesterLookup.has(prerequisiteKey) && resolver.semesterLookup.has(course.key)) {
        const prerequisiteSemester = resolver.semesterLookup.get(prerequisiteKey);
        const courseSemester = resolver.semesterLookup.get(course.key);
        if (prerequisiteSemester > courseSemester) {
          addDiagnostic(diagnostics, "warnings", "PREREQUISITE_AFTER_COURSE", `${prerequisite} is placed after ${course.code}.`, {
            course: course.code,
            prerequisite,
          });
        }
      }
    }
  }
  const parentKeys = derivePublishedParentKeys(resolvedSemesters);
  for (const course of resolver.mainCourses) course.isParentCourse = parentKeys.has(course.key);
  for (const group of resolvedElectiveGroups) {
    for (const course of group.courses) course.isParentCourse = false;
  }
  detectCycles(coursesByKey, diagnostics);
}
