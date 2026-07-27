import { courseCodeKey, normalizeCourseCode, numericValue } from "../../domain/course-code.mjs";
import { normalizeActivityFacts } from "../../domain/course-facts.mjs";

function minutes(value) {
  const match = /^(\d{1,2}):(\d{2})$/u.exec(String(value ?? ""));
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function scheduleHours(schedule) {
  if (!Array.isArray(schedule)) return null;
  const total = schedule.reduce((sum, meeting) => {
    const start = minutes(meeting.startTime);
    const end = minutes(meeting.endTime);
    if (start === null || end === null || end <= start) return sum;
    return sum + Math.round((end - start) / 50);
  }, 0);
  return total || null;
}

function directFacts(item, catalogSource = "catalog") {
  const details = item.details ?? {};
  const codeValue = typeof item.code === "object"
    ? item.code.display ?? item.code.raw
    : item.code ?? item.courseCode ?? item.id;
  if (!codeValue) return null;
  return normalizeActivityFacts({
    code: normalizeCourseCode(codeValue),
    name: item.name ?? item.title ?? item.courseName ?? null,
    academicHours: numericValue(item.academicHours ?? item.creditHours ?? item.hours ?? item.credits),
    lectureHours: numericValue(item.lectureHours ?? item.lecturesHours ?? details.lecturesHours ?? details.lectureHours),
    practicalHours: numericValue(item.practicalHours ?? item.labHours ?? details.labHours ?? details.practicalHours),
    exerciseHours: numericValue(item.exerciseHours ?? item.tutorialHours ?? item.discussionHours ?? details.exercisesHours ?? details.tutorialHours),
    prerequisites: item.prerequisites ?? item.prerequisiteCodes,
    corequisites: item.corequisites ?? item.corequisiteCodes,
    minimumCompletedCredits: numericValue(item.minimumCompletedCredits),
    category: item.category ?? item.type ?? details.category ?? null,
    color: item.color ?? null,
    extinct: Boolean(item.extinct ?? item.isDisabled),
    catalogSource,
  }).facts;
}

function flattenCatalog(raw) {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== "object") return [];
  for (const key of ["courses", "rows", "data", "items", "catalog"]) {
    if (Array.isArray(raw[key])) return raw[key];
  }
  const values = Object.entries(raw);
  if (values.every(([, value]) => value && typeof value === "object" && !Array.isArray(value))) {
    return values.map(([code, value]) => ({ code, ...value }));
  }
  return [];
}

function isCatalogRow(item) {
  return typeof item?.activity === "string" && (Array.isArray(item.schedule) || typeof item.creditHours === "string");
}

function chooseValue(values, field, conflicts) {
  const present = values.filter((value) => value !== null && value !== undefined && value !== "");
  const unique = [...new Map(present.map((value) => [JSON.stringify(value), value])).values()];
  if (unique.length > 1) conflicts.push({ field, values: unique });
  return unique[0] ?? null;
}

function aggregatedFacts(candidates, catalogSource) {
  const conflicts = [];
  const first = candidates[0];
  const facts = {
    code: first.code,
    name: chooseValue(candidates.map((item) => item.name), "name", conflicts),
    academicHours: chooseValue(candidates.map((item) => item.academicHours), "academicHours", conflicts),
    lectureHours: chooseValue(candidates.map((item) => item.lectureHours), "lectureHours", conflicts),
    practicalHours: chooseValue(candidates.map((item) => item.practicalHours), "practicalHours", conflicts),
    exerciseHours: chooseValue(candidates.map((item) => item.exerciseHours), "exerciseHours", conflicts),
    prerequisites: chooseValue(candidates.map((item) => item.prerequisites), "prerequisites", conflicts) ?? undefined,
    corequisites: chooseValue(candidates.map((item) => item.corequisites), "corequisites", conflicts) ?? undefined,
    minimumCompletedCredits: chooseValue(candidates.map((item) => item.minimumCompletedCredits), "minimumCompletedCredits", conflicts),
    category: chooseValue(candidates.map((item) => item.category), "category", conflicts),
    color: chooseValue(candidates.map((item) => item.color), "color", conflicts),
    extinct: candidates.some((item) => item.extinct),
    catalogSource,
    conflicts,
  };
  return normalizeActivityFacts(facts).facts;
}

export function buildCourseCatalog(raw, options = {}) {
  const items = flattenCatalog(raw);
  const map = new Map();
  const rowsByCode = new Map();
  const directByCode = new Map();
  const catalogSource = options.catalogSource ?? "catalog";

  for (const item of items) {
    if (!isCatalogRow(item)) {
      const facts = directFacts(item, catalogSource);
      if (!facts) continue;
      const key = courseCodeKey(facts.code);
      const candidates = directByCode.get(key) ?? [];
      candidates.push(facts);
      directByCode.set(key, candidates);
      continue;
    }
    const code = normalizeCourseCode(item.code);
    const key = courseCodeKey(code);
    const rows = rowsByCode.get(key) ?? [];
    rows.push(item);
    rowsByCode.set(key, rows);
  }

  for (const [key, candidates] of directByCode.entries()) {
    map.set(key, aggregatedFacts(candidates, catalogSource));
  }

  for (const [key, rows] of rowsByCode.entries()) {
    const code = normalizeCourseCode(rows[0].code);
    const conflicts = [];
    const byActivity = (activityNames, field) => {
      const values = [];
      for (const row of rows) {
        if (!activityNames.includes(String(row.activity).trim())) continue;
        const value = scheduleHours(row.schedule);
        if (value !== null) values.push(value);
      }
      return chooseValue(values, field, conflicts);
    };
    const credits = chooseValue(rows.map((row) => numericValue(row.creditHours)), "academicHours", conflicts);
    const name = chooseValue(rows.map((row) => String(row.name ?? "").trim() || null), "name", conflicts);
    map.set(key, normalizeActivityFacts({
      code,
      name,
      academicHours: credits,
      lectureHours: byActivity(["محاضرة"], "lectureHours"),
      practicalHours: byActivity(["عملي", "ستوديو", "تدريب"], "practicalHours"),
      exerciseHours: byActivity(["تمارين"], "exerciseHours"),
      prerequisites: undefined,
      corequisites: undefined,
      minimumCompletedCredits: null,
      category: null,
      color: null,
      extinct: false,
      catalogSource,
      conflicts,
    }).facts);
  }

  return map;
}
