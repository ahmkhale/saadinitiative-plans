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

export function deriveTrackSpecificCourses(plan, siblingPlans = []) {
  const result = structuredClone(plan ?? {});
  const tracks = siblingPlans.length ? siblingPlans : [result];
  const courseSets = tracks.map(trackCourseKeys);
  const trackCount = courseSets.length;

  const deriveEntry = (entry) => {
    const value = typeof entry === "string" ? { code: normalizeCourseCode(entry) } : structuredClone(entry ?? {});
    delete value.trackSpecific;
    const key = courseCodeKey(value.code);
    if (trackCount > 1 && courseSets.filter((set) => set.has(key)).length < trackCount) {
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
