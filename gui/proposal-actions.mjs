import { compareCourseEntries, entryId } from "./plan-model.mjs";

function groupKey(group) {
  return group?.proposalRequirementId ?? group?.sourceId ?? group?.id ?? "";
}

function sortProposalCourseOrders(proposal, publishedSemesters) {
  const entries = new Map((publishedSemesters ?? []).flatMap((semester) => (
    (semester.courses ?? []).map((entry) => [entryId(entry), entry])
  )));
  for (const semester of proposal?.semesters ?? []) {
    semester.courseOrder.sort((left, right) => compareCourseEntries(
      entries.get(left) ?? { code: left },
      entries.get(right) ?? { code: right },
    ));
  }
}

function typicalCourseHours(group) {
  const frequencies = new Map();
  for (const course of group?.courses ?? []) {
    const hours = Number(course.academicHours);
    if (!(hours > 0)) continue;
    frequencies.set(hours, (frequencies.get(hours) ?? 0) + 1);
  }
  return [...frequencies.entries()]
    .sort((left, right) => right[1] - left[1] || right[0] - left[0])[0]?.[0] ?? 3;
}

function distinctCourseHours(group) {
  return [...new Set((group?.courses ?? [])
    .map((course) => Number(course.academicHours))
    .filter((hours) => hours > 0))]
    .sort((left, right) => left - right);
}

export function proposalElectiveOptions(electiveGroups, proposal) {
  const allocated = new Map();
  for (const placeholder of (proposal?.semesters ?? []).flatMap((semester) => semester.placeholders ?? [])) {
    if (!placeholder.electiveGroupId) continue;
    allocated.set(
      placeholder.electiveGroupId,
      (allocated.get(placeholder.electiveGroupId) ?? 0) + (Number(placeholder.allocationHours) || 0),
    );
  }
  return (electiveGroups ?? []).flatMap((group) => {
    const id = groupKey(group);
    const requiredHours = Number(group.requiredHours);
    if (!id || !(requiredHours > 0)) return [];
    const remainingHours = Math.max(0, requiredHours - (allocated.get(id) ?? 0));
    if (remainingHours === 0) return [];
    const courseHours = distinctCourseHours(group);
    return [{
      id,
      name: group.name,
      remainingHours,
      allocationHours: Math.min(remainingHours, typicalCourseHours(group)),
      hasVariableCourseHours: courseHours.length > 1,
    }];
  });
}

export function createElectivePlaceholder(option, id = `placeholder-${Date.now().toString(36)}`) {
  return {
    id,
    name: `من ${option.name}`,
    electiveGroupId: option.id,
    allocationHours: option.allocationHours,
    hoursDisplay: "unknown",
    color: "#000000",
  };
}

export function moveItem(array, index, direction) {
  const next = index + direction;
  if (next < 0 || next >= array.length) return false;
  [array[index], array[next]] = [array[next], array[index]];
  return true;
}

export function createProposalFromPublished(publishedSemesters) {
  const proposal = {
    enabled: true,
    title: "الخطة المقترحة",
    semesters: publishedSemesters.map((semester) => ({
      id: semester.id,
      sourceSemesterId: semester.id,
      type: "regular",
      courseOrder: semester.courses.map(entryId),
      placeholders: [],
    })),
  };
  sortProposalCourseOrders(proposal, publishedSemesters);
  return proposal;
}

export function createProposalSemester(type = "regular") {
  const normalizedType = type === "summer" ? "summer" : "regular";
  return {
    id: `proposal-${normalizedType}-${crypto.randomUUID()}`,
    sourceSemesterId: null,
    type: normalizedType,
    courseOrder: [],
    placeholders: [],
  };
}

export function moveProposalCourse({ proposal, publishedSemesters, fromIndex, courseId, action }) {
  const semesters = proposal?.semesters ?? [];
  const source = semesters[fromIndex];
  if (!source) return false;
  const courseIndex = source.courseOrder.indexOf(courseId);
  if (courseIndex < 0) return false;

  if (action === "up" || action === "down") return false;

  let targetIndex = action === "previous" ? fromIndex - 1 : action === "next" ? fromIndex + 1 : -1;
  if (action === "home") {
    const parent = publishedSemesters.find((semester) => (
      semester.courses.some((entry) => entryId(entry) === courseId)
    ));
    targetIndex = semesters.findIndex((semester) => semester.sourceSemesterId === parent?.id);
  }
  if (targetIndex < 0 || targetIndex >= semesters.length || targetIndex === fromIndex) return false;
  source.courseOrder.splice(courseIndex, 1);
  semesters[targetIndex].courseOrder.push(courseId);
  sortProposalCourseOrders(proposal, publishedSemesters);
  return true;
}

export function dropProposalCourse({ proposal, publishedSemesters, fromIndex, targetIndex, courseId }) {
  const semesters = proposal?.semesters ?? [];
  const source = semesters[fromIndex];
  const target = semesters[targetIndex];
  if (!source || !target) return false;
  const sourceIndex = source.courseOrder.indexOf(courseId);
  if (sourceIndex < 0) return false;
  if (fromIndex === targetIndex) return false;

  source.courseOrder.splice(sourceIndex, 1);
  target.courseOrder.push(courseId);
  sortProposalCourseOrders(proposal, publishedSemesters);
  return true;
}

export function resetProposalToPublished(proposal, publishedSemesters) {
  const placeholders = new Map((proposal?.semesters ?? [])
    .filter((semester) => semester.sourceSemesterId)
    .map((semester) => [semester.sourceSemesterId, semester.placeholders ?? []]));
  return publishedSemesters.map((semester) => ({
    id: semester.id,
    sourceSemesterId: semester.id,
    type: "regular",
    courseOrder: semester.courses.map(entryId),
    placeholders: structuredClone(placeholders.get(semester.id) ?? []),
  }));
}
