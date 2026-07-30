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
    for (const alternatives of course?.prerequisiteAlternatives ?? []) {
      for (const prerequisite of alternatives) {
        const prerequisiteKey = courseCodeKey(prerequisite);
        if (coursesByKey.has(prerequisiteKey)) visit(prerequisiteKey);
      }
    }
    stack.pop();
    state.set(key, 2);
  }
  for (const key of coursesByKey.keys()) visit(key);
}

function validateCourseRequirements(course, coursesByKey, diagnostics, resolver = null) {
  for (const prerequisite of course.prerequisites ?? []) {
    const prerequisiteKey = courseCodeKey(prerequisite);
    if (!coursesByKey.has(prerequisiteKey)) {
      addDiagnostic(diagnostics, "warnings", "PREREQUISITE_NOT_IN_PLAN", `${course.code} refers to ${prerequisite}, which is not present in the plan.`, {
        course: course.code,
        prerequisite,
        location: course.location,
      });
    } else if (resolver?.semesterLookup.has(prerequisiteKey) && resolver.semesterLookup.has(course.key)) {
      const prerequisiteSemester = resolver.semesterLookup.get(prerequisiteKey);
      const courseSemester = resolver.semesterLookup.get(course.key);
      if (prerequisiteSemester > courseSemester) {
        addDiagnostic(diagnostics, "warnings", "PREREQUISITE_AFTER_COURSE", `${prerequisite} is placed after ${course.code}.`, {
          course: course.code,
          prerequisite,
          location: course.location,
        });
      }
    }
  }
  for (const corequisite of course.corequisites ?? []) {
    if (coursesByKey.has(courseCodeKey(corequisite))) continue;
    addDiagnostic(diagnostics, "warnings", "COREQUISITE_NOT_IN_PLAN", `${course.code} refers to companion course ${corequisite}, which is not present in the plan.`, {
      course: course.code,
      corequisite,
      location: course.location,
    });
  }
  for (const alternatives of course.prerequisiteAlternatives ?? []) {
    const available = alternatives.filter((prerequisite) => coursesByKey.has(courseCodeKey(prerequisite)));
    if (!available.length) {
      addDiagnostic(diagnostics, "errors", "PREREQUISITE_ALTERNATIVE_NOT_IN_PLAN", `${course.code} requires at least one of ${alternatives.join(" or ")}, but none is present in the plan.`, {
        course: course.code,
        alternatives,
        location: course.location,
      });
    }
  }
}

export function validatePublishedCourseGraph({ resolver, resolvedSemesters, resolvedElectiveGroups, diagnostics }) {
  const publishedCoursesByKey = new Map();
  for (const course of resolver.mainCourses) {
    if (!publishedCoursesByKey.has(course.key)) publishedCoursesByKey.set(course.key, course);
  }
  const planCoursesByKey = new Map(publishedCoursesByKey);
  for (const group of resolvedElectiveGroups) {
    for (const course of group.courses) {
      if (!planCoursesByKey.has(course.key)) planCoursesByKey.set(course.key, course);
    }
  }
  for (const course of resolver.mainCourses) {
    validateCourseRequirements(course, planCoursesByKey, diagnostics, resolver);
  }
  const parentKeys = derivePublishedParentKeys(resolvedSemesters);
  for (const course of resolver.mainCourses) course.isParentCourse = parentKeys.has(course.key);
  for (const group of resolvedElectiveGroups) {
    for (const course of group.courses) {
      course.isParentCourse = false;
      validateCourseRequirements(course, planCoursesByKey, diagnostics);
    }
  }
  detectCycles(publishedCoursesByKey, diagnostics);
}
