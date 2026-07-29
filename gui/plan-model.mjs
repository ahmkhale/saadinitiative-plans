export function normalizedEntry(entry) {
  return typeof entry === "string" ? { code: entry } : structuredClone(entry);
}

export function entryCode(entry) {
  return typeof entry === "string" ? entry : entry?.code ?? "";
}

export function entryId(entry) {
  return typeof entry === "object" && entry?.id ? entry.id : entryCode(entry);
}

export function removeCourseEntry(target, index, fallbackCourses = null) {
  const removedCode = entryCode(target[index]);
  target.splice(index, 1);
  if (fallbackCourses && !target.some((entry) => entryCode(entry) === removedCode)) {
    delete fallbackCourses[removedCode];
  }
}

export function occurrenceSlug(code) {
  return String(code ?? "").trim().toLocaleLowerCase("ar").replace(/\s+/gu, "-");
}

export function createCourseEntry({ kind, index, code, plan, sharedSetDraft, sharedElectiveDraft }) {
  const slug = occurrenceSlug(code);
  if (kind === "shared") {
    const semester = sharedSetDraft.semesters[index];
    return { id: `shared:${sharedSetDraft.id}:${semester.id}:${slug}`, code };
  }
  if (kind === "sharedElective") {
    return { id: `shared-elective:${sharedElectiveDraft.id}:${slug}`, code };
  }
  if (kind === "elective") {
    return { id: `major:${plan.id}:elective:${plan.electiveGroups[index].id}:${slug}`, code };
  }
  const semester = plan.semesters[index];
  return { id: `major:${plan.id}:${semester.id}:${slug}`, code };
}

export function sourceAppliesToSelection(source, selection) {
  const scope = source?.scope;
  if (!scope || scope.institutionId !== selection.institutionId) return false;
  if (scope.type === "institution") return true;
  if (scope.type === "college") return scope.collegeId === selection.collegeId;
  return scope.type === "majors" && scope.majorIds?.includes(selection.majorId);
}

export function scopeTarget(scope) {
  if (scope?.type === "college") return scope.collegeId ?? "";
  if (scope?.type === "majors") return (scope.majorIds ?? []).join(", ");
  return "";
}

export function scopeFromFields(type, target, institutionId) {
  const scope = { type, institutionId };
  if (type === "college") scope.collegeId = target.trim();
  if (type === "majors") {
    scope.majorIds = target.split(/[,،\n]+/u).map((value) => value.trim()).filter(Boolean);
  }
  return scope;
}

export function parseCodes(value) {
  const text = String(value ?? "").trim();
  if (!text) return [];
  if (/[\n,،;]/u.test(text)) return text.split(/[\n,،;]+/u).map((item) => item.trim()).filter(Boolean);
  const matches = [...text.matchAll(/\d+[A-Za-z]?\s+[\p{L}]+/gu)].map((match) => match[0].trim());
  return matches.length > 1 && matches.join(" ") === text.replace(/\s+/gu, " ") ? matches : [text];
}

const courseCollator = new Intl.Collator("ar", { sensitivity: "base", numeric: true });
const semesterOrdinals = Object.freeze([
  "الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر",
  "الحادي عشر", "الثاني عشر", "الثالث عشر", "الرابع عشر", "الخامس عشر", "السادس عشر", "السابع عشر",
  "الثامن عشر", "التاسع عشر", "العشرون",
]);

export function semesterLabel(level) {
  return `المستوى ${semesterOrdinals[level - 1] ?? "غير المدعوم"}`;
}

export function compareCourseEntries(left, right) {
  const a = entryCode(left);
  const b = entryCode(right);
  const an = Number.parseInt(a, 10);
  const bn = Number.parseInt(b, 10);
  if (an !== bn) return an - bn;
  return courseCollator.compare(a, b);
}


export function sortPublishedCollections(plan) {
  for (const semester of plan?.semesters ?? []) {
    semester.courses = [...(semester.courses ?? [])].sort(compareCourseEntries);
  }
  for (const group of plan?.electiveGroups ?? []) {
    if (group.sourceId) continue;
    group.courses = [...(group.courses ?? [])].sort(compareCourseEntries);
  }
  return plan;
}

export function composeParentTrackPlan(parentPlan, trackPlan) {
  if (!parentPlan) return trackPlan;
  return {
    ...parentPlan,
    ...trackPlan,
    id: parentPlan.id,
    major: parentPlan.major,
    track: trackPlan.track,
    sharedSemesterSets: Array.from(new Set([
      ...(parentPlan.sharedSemesterSets ?? []),
      ...(trackPlan.sharedSemesterSets ?? []),
    ])),
    semesters: [...(parentPlan.semesters ?? []), ...(trackPlan.semesters ?? [])],
    electiveGroups: [...(parentPlan.electiveGroups ?? []), ...(trackPlan.electiveGroups ?? [])],
    fallbackCourses: {
      ...(parentPlan.fallbackCourses ?? {}),
      ...(trackPlan.fallbackCourses ?? {}),
    },
    proposal: trackPlan.proposal ?? null,
  };
}

export function buildPublishedDecisionSemesters(plan, sharedSemesterSets) {
  const inherited = (plan.sharedSemesterSets ?? []).flatMap((id) => {
    const set = sharedSemesterSets.find((item) => item.id === id);
    return (set?.semesters ?? []).map((semester, index) => ({
      ...semester,
      id: `shared-${id}-${semester.id ?? `level-${index + 1}`}`,
    }));
  });
  return [...inherited, ...plan.semesters].map((semester, index) => ({
    ...semester,
    id: semester.id ?? `published-level-${index + 1}`,
    number: index + 1,
    name: semesterLabel(index + 1),
    courses: [...(semester.courses ?? [])].sort(compareCourseEntries),
  }));
}

export function reconcileProposalDraft(plan, sharedSemesterSets) {
  if (!plan?.proposal) return;
  const published = buildPublishedDecisionSemesters(plan, sharedSemesterSets);
  const parent = new Map(published.flatMap((semester) => (
    semester.courses.map((entry) => [entryId(entry), semester.id])
  )));
  const semesters = (plan.proposal.semesters ?? []).map((semester, index) => ({
    id: semester.id ?? `proposal-semester-${index + 1}`,
    sourceSemesterId: semester.sourceSemesterId ?? null,
    type: semester.type === "summer" ? "summer" : "regular",
    courseOrder: semester.courseOrder ?? [],
    placeholders: semester.placeholders ?? [],
  }));
  published.forEach((semester) => {
    if (!semesters.some((item) => item.sourceSemesterId === semester.id)) {
      semesters.push({ id: semester.id, sourceSemesterId: semester.id, type: "regular", courseOrder: [], placeholders: [] });
    }
  });
  const placed = new Set();
  semesters.forEach((semester) => {
    semester.courseOrder = semester.courseOrder.filter((courseId) => (
      parent.has(courseId) && !placed.has(courseId) && placed.add(courseId)
    ));
  });
  for (let index = semesters.length - 1; index >= 0; index -= 1) {
    const semester = semesters[index];
    if (!semester.sourceSemesterId || published.some((item) => item.id === semester.sourceSemesterId)) continue;
    if (semester.placeholders.length) continue;
    if (semester.courseOrder.length) semester.sourceSemesterId = null;
    else semesters.splice(index, 1);
  }
  for (const [courseId, semesterId] of parent) {
    if (placed.has(courseId)) continue;
    const target = semesters.find((semester) => semester.sourceSemesterId === semesterId) ?? semesters[0];
    target?.courseOrder.push(courseId);
    placed.add(courseId);
  }
  plan.proposal.semesters = semesters;
  delete plan.proposal.phases;
  delete plan.proposal.expectedCredits;
}
