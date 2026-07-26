import { addDiagnostic } from "./diagnostics.mjs";
import { normalizeActivityFacts } from "./course-facts.mjs";
import { courseCodeKey, normalizeCourseCode, numericValue } from "./normalize.mjs";
import { semesterLevelName } from "./semester-labels.mjs";

function placeholderCourse(placeholder, semesterIndex, placeholderIndex) {
  const activity = normalizeActivityFacts(placeholder);
  return {
    code: "مقرر",
    key: `__placeholder__${placeholder.id ?? `${semesterIndex + 1}-${placeholderIndex + 1}`}`,
    placeholderId: placeholder.id ?? `placeholder-${semesterIndex + 1}-${placeholderIndex + 1}`,
    name: placeholder.name,
    academicHours: numericValue(placeholder.academicHours) ?? 0,
    lectureHours: numericValue(activity.facts.lectureHours),
    exerciseHours: numericValue(activity.facts.exerciseHours),
    practicalHours: numericValue(activity.facts.practicalHours),
    prerequisites: [],
    corequisites: [],
    prerequisiteConditions: [],
    minimumCompletedCredits: null,
    color: placeholder.color ?? "#000000",
    isParentCourse: false,
    isTrackSpecific: false,
    isExtinct: false,
    isPlaceholder: true,
    source: "proposal-placeholder",
    sourceBadge: "مقرر نائب",
    qualityBadges: activity.allUnknown ? ["بيانات ناقصة"] : [],
  };
}

export function reconcileProposal(publishedPlan, proposal, diagnostics) {
  const authoritative = new Map();
  const publishedSemesterIds = new Set();
  for (const semester of publishedPlan.semesters ?? []) {
    publishedSemesterIds.add(semester.id);
    for (const course of semester.courses ?? []) {
      authoritative.set(courseCodeKey(course.code), { course, semesterId: semester.id });
    }
  }

  let arrangement = (proposal?.semesters ?? []).map((semester, index) => ({
    id: semester.id ?? `proposal-semester-${index + 1}`,
    sourceSemesterId: semester.sourceSemesterId ?? null,
    type: semester.type === "summer" ? "summer" : "regular",
    courseOrder: (semester.courseOrder ?? []).map(normalizeCourseCode),
    placeholders: structuredClone(semester.placeholders ?? []),
  }));

  for (const semester of publishedPlan.semesters ?? []) {
    if (!arrangement.some((entry) => entry.sourceSemesterId === semester.id)) {
      arrangement.push({
        id: semester.id,
        sourceSemesterId: semester.id,
        type: "regular",
        courseOrder: [],
        placeholders: [],
      });
      addDiagnostic(diagnostics, "info", "PROPOSAL_SEMESTER_INHERITED", `${semester.name} was inherited into the proposal.`, {
        sourceSemesterId: semester.id,
      });
    }
  }

  const placed = new Set();
  for (const semester of arrangement) {
    semester.courseOrder = semester.courseOrder.filter((code) => {
      const key = courseCodeKey(code);
      if (!authoritative.has(key)) {
        addDiagnostic(diagnostics, "info", "PROPOSAL_PARENT_COURSE_REMOVED", `${code} was removed because it is no longer published.`, {
          course: code,
          proposalSemester: semester.id,
        });
        return false;
      }
      if (placed.has(key)) {
        addDiagnostic(diagnostics, "errors", "DUPLICATE_PROPOSAL_COURSE", `${code} appears more than once in the proposal arrangement.`, {
          course: code,
          proposalSemester: semester.id,
        });
        return false;
      }
      placed.add(key);
      return true;
    });
  }

  arrangement = arrangement.filter((semester) => {
    if (!semester.sourceSemesterId || publishedSemesterIds.has(semester.sourceSemesterId)) return true;
    if (semester.placeholders.length) {
      addDiagnostic(diagnostics, "errors", "PROPOSAL_ORPHANED_PLACEHOLDERS", `${semester.id} still has placeholders from a removed published semester. Move or delete them before continuing.`, {
        proposalSemester: semester.id,
        sourceSemesterId: semester.sourceSemesterId,
        location: `proposal-${semester.id}`,
      });
      return true;
    }
    if (semester.courseOrder.length) {
      addDiagnostic(diagnostics, "info", "PROPOSAL_SEMESTER_DETACHED", `${semester.id} was retained as a proposal-added regular semester after its published source was removed.`, {
        proposalSemester: semester.id,
        sourceSemesterId: semester.sourceSemesterId,
      });
      semester.sourceSemesterId = null;
      return true;
    }
    addDiagnostic(diagnostics, "info", "PROPOSAL_SEMESTER_REMOVED", `${semester.id} was removed with its published source semester.`, {
      proposalSemester: semester.id,
      sourceSemesterId: semester.sourceSemesterId,
    });
    return false;
  });

  for (const [key, { course, semesterId }] of authoritative) {
    if (placed.has(key)) continue;
    const target = arrangement.find((semester) => semester.sourceSemesterId === semesterId)
      ?? arrangement.find((semester) => semester.type === "regular")
      ?? arrangement[0];
    if (!target) continue;
    target.courseOrder.push(course.code);
    placed.add(key);
    addDiagnostic(diagnostics, "info", "PROPOSAL_COURSE_INHERITED", `${course.code} was newly inherited from the published plan.`, {
      course: course.code,
      proposalSemester: target.id,
    });
  }

  let regularIndex = 0;
  let summerIndex = 0;
  let cumulativeHours = 0;
  const proposalPlacement = new Map();
  const semesters = arrangement.map((semester, semesterIndex) => {
    const realCourses = semester.courseOrder
      .map((code) => authoritative.get(courseCodeKey(code))?.course)
      .filter(Boolean)
      .map((course) => structuredClone(course));
    const placeholders = semester.placeholders.map((placeholder, placeholderIndex) => (
      placeholderCourse(placeholder, semesterIndex, placeholderIndex)
    ));
    const name = semester.type === "summer"
      ? (++summerIndex === 1 ? "الفصل الصيفي" : `الفصل الصيفي ${summerIndex}`)
      : semesterLevelName(++regularIndex);
    const academicHours = [...realCourses, ...placeholders]
      .reduce((sum, course) => sum + (numericValue(course.academicHours) ?? 0), 0);
    for (const course of realCourses) {
      proposalPlacement.set(courseCodeKey(course.code), { semesterIndex, semesterId: semester.id });
    }
    cumulativeHours += academicHours;
    return {
      id: semester.id,
      sourceSemesterId: semester.sourceSemesterId,
      type: semester.type,
      number: semesterIndex + 1,
      name,
      academicHours,
      cumulativeHours,
      courseDisplayOrder: "rtl",
      courses: [...realCourses, ...placeholders],
    };
  });

  for (const { course } of authoritative.values()) {
    const placement = proposalPlacement.get(courseCodeKey(course.code));
    if (!placement) continue;
    for (const prerequisite of course.prerequisites ?? []) {
      const prerequisitePlacement = proposalPlacement.get(courseCodeKey(prerequisite));
      if (prerequisitePlacement && prerequisitePlacement.semesterIndex > placement.semesterIndex) {
        addDiagnostic(diagnostics, "warnings", "PROPOSAL_PREREQUISITE_AFTER_COURSE", `${prerequisite} is placed after ${course.code} in the proposal.`, {
          course: course.code,
          prerequisite,
          proposalSemester: placement.semesterId,
          location: `proposal-${placement.semesterId}`,
        });
      }
    }
    for (const corequisite of course.corequisites ?? []) {
      const corequisitePlacement = proposalPlacement.get(courseCodeKey(corequisite));
      if (corequisitePlacement && corequisitePlacement.semesterIndex !== placement.semesterIndex) {
        addDiagnostic(diagnostics, "warnings", "PROPOSAL_COREQUISITE_SEPARATED", `${corequisite} is separated from ${course.code} in the proposal.`, {
          course: course.code,
          corequisite,
          proposalSemester: placement.semesterId,
          location: `proposal-${placement.semesterId}`,
        });
      }
    }
  }

  return {
    enabled: proposal?.enabled !== false,
    title: proposal?.title ?? "الخطة المقترحة",
    showGuide: proposal?.showGuide !== false,
    semesters,
    totalHours: cumulativeHours,
    semesterCount: semesters.length,
    courseCount: authoritative.size,
    phases: null,
  };
}
