import { GENERATOR_VERSION } from "../version.mjs";
import { addDiagnostic } from "../domain/diagnostics.mjs";
import { numericValue } from "../domain/course-code.mjs";
import { normalizeCourseGuidePages } from "../domain/course-guide.mjs";
import { normalizeActivityTypes } from "../domain/course-facts.mjs";
import { createCourseResolver } from "./course-resolver.mjs";
import { resolvePublishedSemesters } from "./resolve-semesters.mjs";
import { resolveElectiveGroups } from "./resolve-electives.mjs";
import { validatePublishedCourseGraph } from "./validate-course-graph.mjs";
import { reconcileProposal } from "./reconcile-proposal.mjs";

export function resolvePlan(plan, catalog, colors, diagnostics, options = {}) {
  const displayMajor = plan.track?.name
    ? `${plan.major} ${plan.track.name}`
    : plan.major;
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
  const electiveHours = resolvedElectiveGroups.reduce(
    (sum, group) => sum + (numericValue(group.requiredHours) ?? 0),
    0,
  );
  const totalHours = cumulative + electiveHours;
  const activityTypes = normalizeActivityTypes([
    ...resolvedSemesters.flatMap((semester) => semester.courses.flatMap((course) => course.activityTypes ?? [])),
    ...resolvedElectiveGroups.flatMap((group) => group.courses.flatMap((course) => course.activityTypes ?? [])),
  ]);
  const expectedCredits = numericValue(plan.expectedCredits);
  if (expectedCredits !== null && expectedCredits > 0 && totalHours !== expectedCredits) {
    addDiagnostic(diagnostics, "warnings", "PLAN_HOURS_MISMATCH", `Calculated plan hours are ${totalHours} (${cumulative} published + ${electiveHours} elective), expected ${plan.expectedCredits}.`, {
      calculated: totalHours,
      published: cumulative,
      elective: electiveHours,
      expected: expectedCredits,
    });
  }

  const result = {
    schemaVersion: 1,
    generatorVersion: GENERATOR_VERSION,
    id: plan.id ?? null,
    university: plan.university,
    college: plan.college,
    major: displayMajor,
    baseMajor: plan.major,
    track: plan.track ?? null,
    degree: plan.degree,
    planCode: plan.planCode,
    version: plan.version,
    edition: plan.edition ?? options.settings?.edition ?? null,
    release: plan.release ?? options.settings?.release ?? null,
    courseGuidePages: normalizeCourseGuidePages(options.settings?.courseGuidePages),
    headerSubtitle: plan.headerSubtitle ?? null,
    phases: plan.phases ?? null,
    footer: plan.footer ?? null,
    expectedCredits,
    publishedHours: cumulative,
    electiveHours,
    totalHours,
    activityTypes,
    semesterCount: resolvedSemesters.length,
    courseCount: resolver.mainCourses.length,
    electiveCourseCount: resolvedElectiveGroups.reduce((sum, group) => sum + group.courses.length, 0),
    semesters: resolvedSemesters,
    electiveGroups: resolvedElectiveGroups,
    proposal: null,
  };

  if (plan.proposal && !options.skipProposal) {
    const reconciledProposal = reconcileProposal(result, plan.proposal, diagnostics);
    result.proposal = {
      ...reconciledProposal,
      id: plan.id ? `${plan.id}-proposal` : null,
      university: result.university,
      college: result.college,
      major: result.major,
      degree: result.degree,
      edition: result.edition,
      release: result.release,
      headerSubtitle: displayMajor,
    };
    if (reconciledProposal.totalHours !== totalHours) {
      addDiagnostic(
        diagnostics,
        "warnings",
        "PROPOSAL_HOURS_MISMATCH",
        `Proposal hours are ${reconciledProposal.totalHours}, but the main plan totals ${totalHours} (${cumulative} published + ${electiveHours} elective).`,
        {
          proposal: reconciledProposal.totalHours,
          mainPlan: totalHours,
          published: cumulative,
          elective: electiveHours,
          difference: reconciledProposal.totalHours - totalHours,
        },
      );
    }
  }

  return result;
}
