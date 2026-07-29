import { courseCodeKey, normalizeCourseCode } from "./course-code.mjs";

function ownCourseEntries(plan = {}) {
  return [
    ...(plan.semesters ?? []).flatMap((semester) => semester.courses ?? []),
    ...(plan.electiveGroups ?? [])
      .filter((group) => !group?.sourceId)
      .flatMap((group) => group.courses ?? []),
  ];
}

export function trackCourseKeys(plan = {}) {
  return new Set(ownCourseEntries(plan)
    .map((entry) => courseCodeKey(typeof entry === "string" ? entry : entry?.code))
    .filter(Boolean));
}

export function collectFallbackCourses(plans = []) {
  return Object.fromEntries(
    plans
      .flatMap((plan) => Object.entries(plan?.fallbackCourses ?? {}))
      .map(([code, facts]) => [normalizeCourseCode(code), structuredClone(facts)]),
  );
}

export function deriveTrackSpecificCourses(plan, siblingPlans = [], parentPlan = null) {
  const result = structuredClone(plan ?? {});
  const tracks = siblingPlans.length ? siblingPlans : [result];
  const courseSets = tracks.map(trackCourseKeys);
  const parentCourseKeys = trackCourseKeys(parentPlan ?? {});

  const deriveEntry = (entry) => {
    const value = typeof entry === "string" ? { code: normalizeCourseCode(entry) } : structuredClone(entry ?? {});
    delete value.trackSpecific;
    const key = courseCodeKey(value.code);
    const owningTrackCount = courseSets.filter((set) => set.has(key)).length;
    if (!parentCourseKeys.has(key) && owningTrackCount === 1) {
      value.trackSpecific = true;
    }
    return value;
  };

  result.semesters = (result.semesters ?? []).map((semester) => ({
    ...semester,
    courses: (semester.courses ?? []).map(deriveEntry),
  }));
  result.electiveGroups = (result.electiveGroups ?? []).map((group) => group?.sourceId ? group : ({
    ...group,
    courses: (group.courses ?? []).map(deriveEntry),
  }));
  return result;
}

export function cleanTrack(input, forcedId = null) {
  const id = String(forcedId ?? input?.id ?? "").trim();
  const name = String(input?.name ?? "").trim();
  if (!id) throw new Error("Track id is required.");
  if (!name) throw new Error("Track name is required.");
  return { id, name };
}

export function composeTrackPlan(parentPlan, trackPlan) {
  if (!trackPlan?.track) return structuredClone(parentPlan ?? {});
  const parent = structuredClone(parentPlan ?? {});
  const child = structuredClone(trackPlan);
  return {
    ...parent,
    ...child,
    schemaVersion: parent.schemaVersion ?? child.schemaVersion ?? 1,
    id: parent.id,
    major: parent.major,
    degree: parent.degree,
    track: child.track,
    sharedSemesterSets: Array.from(new Set([
      ...(parent.sharedSemesterSets ?? []),
      ...(child.sharedSemesterSets ?? []),
    ])),
    semesters: [
      ...(parent.semesters ?? []),
      ...(child.semesters ?? []),
    ],
    electiveGroups: [
      ...(parent.electiveGroups ?? []),
      ...(child.electiveGroups ?? []),
    ],
    fallbackCourses: {
      ...(parent.fallbackCourses ?? {}),
      ...(child.fallbackCourses ?? {}),
    },
    proposal: child.proposal ?? null,
  };
}
