import { numericValue } from "../domain/course-code.mjs";
import {
  canonicalFallbackCourses,
  normalizeElectiveGroups,
  normalizeProposal,
  normalizeSemesters,
} from "../domain/plan-normalization.mjs";

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
    track: value.track ? {
      id: String(value.track.id ?? "").trim(),
      name: String(value.track.name ?? "").trim(),
    } : null,
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
  if (!Array.isArray(plan.semesters) || (!plan.track && plan.semesters.length === 0)) {
    errors.push("parent plans must contain at least one semester.");
  }
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
