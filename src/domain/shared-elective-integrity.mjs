import { ACTIVITY_FIELDS } from "./course-facts.mjs";
import { courseCodeKey, normalizeCourseCode, numericValue } from "./course-code.mjs";

function entryCode(entry) {
  return normalizeCourseCode(typeof entry === "string" ? entry : entry?.code);
}

function fallbackByKey(fallbackCourses = {}) {
  return new Map(Object.entries(fallbackCourses).map(([code, facts]) => [
    courseCodeKey(code),
    { code: normalizeCourseCode(code), facts },
  ]));
}

export function sharedElectiveIntegrityIssues(source, catalog = new Map()) {
  const issues = [];
  const codes = (source?.courses ?? []).map(entryCode).filter(Boolean);
  const codeCounts = new Map();
  for (const code of codes) {
    const key = courseCodeKey(code);
    codeCounts.set(key, { code, count: (codeCounts.get(key)?.count ?? 0) + 1 });
  }
  for (const { code, count } of codeCounts.values()) {
    if (count > 1) issues.push({ type: "duplicate-course", code });
  }

  const ownedKeys = new Set(codeCounts.keys());
  const fallbacks = fallbackByKey(source?.fallbackCourses);
  for (const [key, fallback] of fallbacks) {
    if (!ownedKeys.has(key)) issues.push({ type: "orphan-fallback", code: fallback.code });
  }

  for (const [key, { code }] of codeCounts) {
    if (catalog.has(key)) continue;
    const fallback = fallbacks.get(key)?.facts;
    const missing = [];
    if (!String(fallback?.name ?? "").trim()) missing.push("name");
    if (numericValue(fallback?.academicHours) === null) missing.push("academicHours");
    if (!ACTIVITY_FIELDS.some((field) => numericValue(fallback?.[field]) !== null)) {
      missing.push(...ACTIVITY_FIELDS);
    }
    if (missing.length) issues.push({ type: "unresolved-course", code, missing });
  }
  return issues;
}

export function assertSharedElectiveIntegrity(source, catalog = new Map()) {
  const issues = sharedElectiveIntegrityIssues(source, catalog);
  if (!issues.length) return source;
  const duplicates = issues.filter((issue) => issue.type === "duplicate-course").map((issue) => issue.code);
  const orphans = issues.filter((issue) => issue.type === "orphan-fallback").map((issue) => issue.code);
  const unresolved = issues.filter((issue) => issue.type === "unresolved-course").map((issue) => issue.code);
  const messages = [
    duplicates.length ? `مقررات مكررة: ${duplicates.join("، ")}` : null,
    orphans.length ? `بيانات بديلة لا يملكها المصدر: ${orphans.join("، ")}` : null,
    unresolved.length ? `مقررات غير موجودة في الدليل وتحتاج بيانات بديلة مكتملة: ${unresolved.join("، ")}` : null,
  ].filter(Boolean);
  throw new Error(`لا يمكن حفظ المصدر الاختياري المشترك. ${messages.join(". ")}.`);
}
