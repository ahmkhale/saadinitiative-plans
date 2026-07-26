import { normalizeCourseCode, courseCodeKey, numericValue } from "./normalize.mjs";

const LEVEL_LABELS = [
  "الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس",
  "السابع", "الثامن", "التاسع", "العاشر", "الحادي عشر", "الثاني عشر",
];

function levelName(level) {
  return `المستوى ${LEVEL_LABELS[level - 1] ?? level}`;
}

function websiteCourseToEntry(course) {
  return {
    code: normalizeCourseCode(course.code),
    fallback: {
      name: course.fallbackName,
      academicHours: course.fallbackCreditHours,
      lectureHours: course.lectureHours,
      practicalHours: course.practicalHours ?? course.labHours,
      exerciseHours: course.exerciseHours ?? course.tutorialHours,
      prerequisites: course.prerequisites ?? [],
      corequisites: course.corequisites ?? [],
      minimumCompletedCredits: course.minimumCompletedCredits,
      trackSpecific: Boolean(course.trackSpecific),
      extinct: Boolean(course.extinct),
      requirement: course.requirement ?? "required",
    },
    requirement: course.requirement ?? "required",
    trackSpecific: Boolean(course.trackSpecific),
    extinct: Boolean(course.extinct),
  };
}

function normalizeStandaloneCourse(entry) {
  if (typeof entry === "string") return { code: normalizeCourseCode(entry) };
  if (!entry || typeof entry !== "object") throw new Error("Every course must be a code string or object.");
  const normalized = {
    ...entry,
    code: normalizeCourseCode(entry.code),
  };
  for (const field of ["prerequisites", "corequisites", "minimumCompletedCredits", "trackSpecific"]) {
    if (normalized[field] === undefined && normalized.override?.[field] !== undefined) {
      normalized[field] = structuredClone(normalized.override[field]);
    }
  }
  return normalized;
}

function normalizeElectiveGroups(groups = []) {
  return groups.map((group, index) => ({
    ...group,
    id: group.id ?? `elective-group-${index + 1}`,
    name: group.name ?? `مجموعة اختيارية ${index + 1}`,
    requiredHours: group.requirementText === undefined
      ? group.requiredHours ?? group.requiredCreditHours ?? group.expectedCredits ?? 0
      : undefined,
    requirementText: group.requirementText,
    sortCourses: group.sortCourses ?? "code",
    courses: (group.courses ?? []).map(normalizeStandaloneCourse),
  }));
}

function normalizeSemesters(semesters = []) {
  return semesters.map((semester, index) => ({
    ...semester,
    number: semester.number ?? semester.level ?? index + 1,
    name: semester.name ?? levelName(semester.number ?? semester.level ?? index + 1),
    courses: (semester.courses ?? []).map(normalizeStandaloneCourse),
  }));
}

function normalizeProposal(proposal) {
  if (!proposal || typeof proposal !== "object") return null;
  const semesters = (proposal.semesters ?? []).map((semester, index) => {
    if (Array.isArray(semester.courseOrder) || Array.isArray(semester.placeholders)) {
      return {
        ...semester,
        id: semester.id ?? `level-${index + 1}`,
        number: semester.number ?? index + 1,
        name: semester.name ?? levelName(semester.number ?? index + 1),
        courseOrder: (semester.courseOrder ?? []).map(normalizeCourseCode),
        placeholders: (semester.placeholders ?? []).map((placeholder, placeholderIndex) => ({
          ...placeholder,
          id: placeholder.id ?? `placeholder-${index + 1}-${placeholderIndex + 1}`,
        })),
      };
    }
    const entries = (semester.courses ?? []).map(normalizeStandaloneCourse);
    return {
      ...semester,
      id: semester.id ?? `level-${index + 1}`,
      number: semester.number ?? index + 1,
      name: semester.name ?? levelName(semester.number ?? index + 1),
      courseOrder: entries.filter((entry) => entry.kind !== "placeholder").map((entry) => entry.code),
      placeholders: entries.filter((entry) => entry.kind === "placeholder").map((entry, placeholderIndex) => ({
        id: `placeholder-${index + 1}-${placeholderIndex + 1}`,
        name: entry.fallback?.name ?? "مقرر نائب",
        academicHours: entry.fallback?.academicHours,
        lectureHours: entry.fallback?.lectureHours,
        exerciseHours: entry.fallback?.exerciseHours,
        practicalHours: entry.fallback?.practicalHours,
        color: entry.fallback?.color ?? "#000000",
      })),
    };
  });
  return {
    ...proposal,
    title: proposal.title ?? "الخطة المقترحة",
    expectedCredits: proposal.expectedCredits ?? proposal.credits,
    phases: proposal.phases,
    semesters,
  };
}

function registryElectiveGroups(plan, categories, semesterEntries, fallbackCourses) {
  if (!Array.isArray(plan.electiveCategoryIds) || !Array.isArray(categories)) return [];
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const mainHours = new Map();
  for (const semester of semesterEntries) {
    for (const entry of semester.courses) {
      const fallback = fallbackCourses[entry.code] ?? {};
      mainHours.set(courseCodeKey(entry.code), numericValue(fallback.academicHours) ?? 0);
    }
  }

  return plan.electiveCategoryIds.flatMap((id) => {
    const category = categoryById.get(id);
    if (!category) return [];
    const includedHours = (category.courses ?? []).reduce((sum, course) => {
      const key = courseCodeKey(course.code);
      return sum + (mainHours.has(key) ? (mainHours.get(key) ?? numericValue(course.fallbackCreditHours) ?? 0) : 0);
    }, 0);
    const courses = [];
    for (const course of category.courses ?? []) {
      const converted = websiteCourseToEntry(course);
      fallbackCourses[converted.code] = converted.fallback;
      if (!mainHours.has(courseCodeKey(converted.code))) {
        delete converted.fallback;
        courses.push(converted);
      }
    }
    if (!courses.length) return [];
    return [{
      id: category.id,
      name: category.name,
      requiredHours: Math.max(0, (numericValue(category.requiredCreditHours) ?? 0) - includedHours),
      sortCourses: "input",
      courses,
    }];
  });
}

export function normalizePlanInput(raw, options = {}) {
  let value = raw;
  let registryElectiveCategories = null;
  if (Array.isArray(value)) {
    if (value.length !== 1) throw new Error("A plan array must contain exactly one plan.");
    [value] = value;
  }

  if (value?.plans && Array.isArray(value.plans)) {
    registryElectiveCategories = value.electiveCategories ?? [];
    const planId = options.planId;
    if (!planId) throw new Error("This is a plan registry. Pass --plan-id <id>.");
    value = value.plans.find((plan) => plan.id === planId);
    if (!value) throw new Error(`Plan '${planId}' was not found in the registry.`);
  }

  if (!value || typeof value !== "object") throw new Error("Plan JSON must be an object.");

  // Existing Saad website PlanDefinition shape.
  if (value.name && value.degree && Array.isArray(value.semesters) && value.semesters[0]?.catalogCollege) {
    const fallbackCourses = {};
    const semesters = value.semesters.map((semester, index) => {
      const courses = semester.courses.map((course) => {
        const converted = websiteCourseToEntry(course);
        fallbackCourses[converted.code] = converted.fallback;
        delete converted.fallback;
        return converted;
      });
      return {
        number: semester.level ?? index + 1,
        name: levelName(semester.level ?? index + 1),
        yearLabel: semester.yearLabel,
        catalogCollege: semester.catalogCollege,
        courses,
      };
    });
    const electiveGroups = registryElectiveGroups(value, registryElectiveCategories, semesters, fallbackCourses);
    return {
      schemaVersion: 1,
      id: value.id,
      university: value.university ?? "جامعة الملك سعود",
      college: value.college,
      major: value.name,
      degree: value.degree === "bachelor" ? "البكالوريوس" : value.degree,
      planCode: value.id,
      version: value.version ?? "",
      edition: value.edition,
      release: value.release,
      headerSubtitle: value.headerSubtitle,
      phases: value.phases,
      footer: value.footer,
      proposal: normalizeProposal(value.proposal),
      // The renderer's Figma color-style map is the source of truth.
      // Legacy website colors can still be copied into a standalone plan as explicit overrides.
      courseColors: {},
      semesters,
      electiveGroups,
      fallbackCourses,
      sourceFormat: "saad-web-plan-definition",
    };
  }

  const semesters = normalizeSemesters(value.semesters ?? []);

  return {
    schemaVersion: value.schemaVersion ?? 1,
    id: value.id,
    university: value.university ?? "جامعة الملك سعود",
    college: value.college ?? "",
    major: value.major ?? value.name,
    degree: value.degree ?? "البكالوريوس",
    planCode: value.planCode ?? value.code ?? value.id ?? "",
    version: value.version ?? value.planVersion ?? "",
    edition: value.edition,
    release: value.release,
    headerSubtitle: value.headerSubtitle,
    expectedCredits: value.expectedCredits ?? value.credits,
    sortCourses: value.sortCourses ?? "code",
    courseColors: value.courseColors ?? {},
    fallbackCourses: value.fallbackCourses ?? {},
    phases: value.phases,
    sharedSemesterSets: value.sharedSemesterSets ?? [],
    footer: value.footer,
    semesters,
    electiveGroups: normalizeElectiveGroups(value.electiveGroups ?? value.requirementGroups ?? []),
    proposal: normalizeProposal(value.proposal),
    sourceFormat: value.sourceFormat ?? "standalone",
  };
}

export function validatePlanShape(plan) {
  const errors = [];
  if (plan.schemaVersion !== 1) errors.push("schemaVersion must be 1.");
  if (!String(plan.major ?? "").trim()) errors.push("major is required.");
  if (!Array.isArray(plan.semesters) || plan.semesters.length === 0) errors.push("semesters must contain at least one semester.");
  for (const [index, semester] of (plan.semesters ?? []).entries()) {
    if (!Array.isArray(semester.courses)) errors.push(`semesters[${index}].courses must be an array.`);
    for (const [courseIndex, course] of (semester.courses ?? []).entries()) {
      if (!course.code) errors.push(`semesters[${index}].courses[${courseIndex}] has no code.`);
    }
  }
  for (const [groupIndex, group] of (plan.electiveGroups ?? []).entries()) {
    if (!Array.isArray(group.courses)) errors.push(`electiveGroups[${groupIndex}].courses must be an array.`);
    for (const [courseIndex, course] of (group.courses ?? []).entries()) {
      if (!course.code) errors.push(`electiveGroups[${groupIndex}].courses[${courseIndex}] has no code.`);
    }
    const hasHours = numericValue(group.requiredHours) !== null;
    const hasText = Boolean(String(group.requirementText ?? "").trim());
    if (hasHours === hasText) errors.push(`electiveGroups[${groupIndex}] must define exactly one of requiredHours or requirementText.`);
  }
  if (plan.proposal) {
    if (!Array.isArray(plan.proposal.semesters) || plan.proposal.semesters.length === 0) {
      errors.push("proposal.semesters must contain at least one semester.");
    }
    for (const [semesterIndex, semester] of (plan.proposal.semesters ?? []).entries()) {
      if (!Array.isArray(semester.courseOrder)) errors.push(`proposal.semesters[${semesterIndex}].courseOrder must be an array.`);
      if (!Array.isArray(semester.placeholders)) errors.push(`proposal.semesters[${semesterIndex}].placeholders must be an array.`);
    }
  }
  if (errors.length) throw new Error(`Invalid plan:\n- ${errors.join("\n- ")}`);
}
