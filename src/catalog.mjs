import { courseCodeKey, normalizeCourseCode, numericValue } from "./normalize.mjs";

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

function directFacts(item) {
  const details = item.details ?? {};
  const codeValue = typeof item.code === "object"
    ? item.code.display ?? item.code.raw
    : item.code ?? item.courseCode ?? item.id;
  if (!codeValue) return null;
  return {
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
    source: "catalog",
  };
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

export function buildCourseCatalog(raw) {
  const items = flattenCatalog(raw);
  const map = new Map();
  const rowsByCode = new Map();

  for (const item of items) {
    if (!isCatalogRow(item)) {
      const facts = directFacts(item);
      if (!facts) continue;
      map.set(courseCodeKey(facts.code), facts);
      continue;
    }
    const code = normalizeCourseCode(item.code);
    const key = courseCodeKey(code);
    const rows = rowsByCode.get(key) ?? [];
    rows.push(item);
    rowsByCode.set(key, rows);
  }

  for (const [key, rows] of rowsByCode.entries()) {
    const code = normalizeCourseCode(rows[0].code);
    const byActivity = (activityNames) => {
      let max = null;
      for (const row of rows) {
        if (!activityNames.includes(String(row.activity).trim())) continue;
        const value = scheduleHours(row.schedule);
        if (value !== null) max = Math.max(max ?? 0, value);
      }
      return max;
    };
    const credits = rows.reduce((max, row) => Math.max(max, numericValue(row.creditHours) ?? 0), 0);
    map.set(key, {
      code,
      name: rows.find((row) => String(row.name ?? "").trim())?.name?.trim() ?? null,
      academicHours: credits || null,
      lectureHours: byActivity(["محاضرة"]),
      practicalHours: byActivity(["عملي", "ستوديو", "تدريب"]),
      exerciseHours: byActivity(["تمارين"]),
      prerequisites: undefined,
      corequisites: undefined,
      minimumCompletedCredits: null,
      category: null,
      color: null,
      extinct: false,
      source: "catalog-rows",
    });
  }

  return map;
}
