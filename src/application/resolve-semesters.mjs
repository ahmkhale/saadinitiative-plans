import { addDiagnostic } from "../domain/diagnostics.mjs";
import { compareCourseCodes, courseCodeKey, numericValue } from "../domain/course-code.mjs";

export function resolvePublishedSemesters(plan, resolver, diagnostics) {
  return plan.semesters.map((semester, semesterIndex) => {
    const sameGroupKeys = new Set(semester.courses.map((entry) => courseCodeKey(entry.code)));
    const resolvedCourses = semester.courses.map((entry, entryIndex) => resolver.resolveEntry(entry, {
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
}
