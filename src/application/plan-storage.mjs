import {
  canonicalCourseEntry,
  canonicalFallbackCourses,
  normalizeProposal,
  stripDerivedSemesterFields,
} from "../domain/plan-normalization.mjs";

export function preparePlanForEditor(rawPlan) {
  return canonicalizePlanForStorage(rawPlan);
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
