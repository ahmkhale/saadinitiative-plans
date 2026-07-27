import { addDiagnostic } from "../../domain/diagnostics.mjs";
import { courseNameFit, prerequisiteFit } from "../svg/text-fit.mjs";

function allRenderedCourses(plan) {
  return [
    ...(plan.semesters ?? []).flatMap((semester) => semester.courses ?? []),
    ...(plan.electiveGroups ?? []).flatMap((group) => group.courses ?? []),
    ...(plan.proposal?.semesters ?? []).flatMap((semester) => semester.courses ?? []),
  ];
}

export function validateRenderedText(plan, diagnostics) {
  const seen = new Set();
  for (const course of allRenderedCourses(plan)) {
    if (course.isPlaceholder) continue;
    const identity = `${course.id ?? course.code}:${course.name}:${course.requirementLabel ?? ""}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    const nameFit = courseNameFit(course.name);
    if (nameFit.overflow) {
      addDiagnostic(diagnostics, "warnings", "COURSE_NAME_MINIMUM_SIZE", `${course.code} remains wider than the course card at the minimum readable size.`, {
        course: course.code,
        minimumSize: nameFit.size,
        location: course.location,
      });
    }
    if (course.requirementLabel && prerequisiteFit(course.requirementLabel, 43).overflow) {
      addDiagnostic(diagnostics, "warnings", "PREREQUISITE_TEXT_MINIMUM_SIZE", `${course.code} prerequisite text remains wider than the pill at the minimum readable size.`, {
        course: course.code,
        location: course.location,
      });
    }
  }
}
