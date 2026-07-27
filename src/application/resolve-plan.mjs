import { GENERATOR_VERSION } from "../version.mjs";
import { addDiagnostic } from "../domain/diagnostics.mjs";
import { numericValue } from "../domain/course-code.mjs";
import { createCourseResolver } from "./course-resolver.mjs";
import { resolvePublishedSemesters } from "./resolve-semesters.mjs";
import { resolveElectiveGroups } from "./resolve-electives.mjs";
import { validatePublishedCourseGraph } from "./validate-course-graph.mjs";
import { reconcileProposal } from "./reconcile-proposal.mjs";

export function resolvePlan(plan, catalog, colors, diagnostics, options = {}) {
  const resolver = createCourseResolver({ plan, catalog, colors, diagnostics });
  const resolvedSemesters = resolvePublishedSemesters(plan, resolver, diagnostics);
  const resolvedElectiveGroups = resolveElectiveGroups(plan, resolver, diagnostics);

  validatePublishedCourseGraph({
    resolver,
    resolvedSemesters,
    resolvedElectiveGroups,
    diagnostics,
  });

  let cumulative = 0;
  for (const semester of resolvedSemesters) {
    cumulative += semester.academicHours;
    semester.cumulativeHours = cumulative;
  }
  const totalHours = cumulative;
  if (numericValue(plan.expectedCredits) !== null && totalHours !== numericValue(plan.expectedCredits)) {
    addDiagnostic(diagnostics, "warnings", "PLAN_HOURS_MISMATCH", `Calculated plan hours are ${totalHours}, expected ${plan.expectedCredits}.`, {
      calculated: totalHours,
      expected: plan.expectedCredits,
    });
  }

  const result = {
    schemaVersion: 1,
    generatorVersion: GENERATOR_VERSION,
    id: plan.id ?? null,
    university: plan.university,
    college: plan.college,
    major: plan.major,
    degree: plan.degree,
    planCode: plan.planCode,
    version: plan.version,
    edition: plan.edition ?? options.settings?.edition ?? null,
    release: plan.release ?? options.settings?.release ?? null,
    headerSubtitle: plan.headerSubtitle ?? null,
    phases: plan.phases ?? null,
    footer: plan.footer ?? null,
    expectedCredits: numericValue(plan.expectedCredits),
    totalHours,
    semesterCount: resolvedSemesters.length,
    courseCount: resolver.mainCourses.length,
    electiveCourseCount: resolvedElectiveGroups.reduce((sum, group) => sum + group.courses.length, 0),
    semesters: resolvedSemesters,
    electiveGroups: resolvedElectiveGroups,
    proposal: null,
  };

  if (plan.proposal && !options.skipProposal) {
    result.proposal = {
      ...reconcileProposal(result, plan.proposal, diagnostics),
      id: plan.id ? `${plan.id}-proposal` : null,
      university: result.university,
      college: result.college,
      major: result.major,
      degree: result.degree,
      edition: result.edition,
      release: result.release,
      headerSubtitle: plan.major,
    };
  }

  return result;
}
