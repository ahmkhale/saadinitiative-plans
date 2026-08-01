import { numericValue } from "./course-code.mjs";

export const ACTIVITY_FIELDS = Object.freeze([
  "lectureHours",
  "exerciseHours",
  "practicalHours",
]);

export const ACTIVITY_SOURCE_ALIASES = Object.freeze({
  lectureHours: Object.freeze(["محاضرة"]),
  exerciseHours: Object.freeze(["تمارين", "عيادة"]),
  practicalHours: Object.freeze(["عملي", "ستوديو", "حقلي", "تدريب", "مشروع"]),
});

export const ACTIVITY_TYPES = Object.freeze([
  "محاضرة",
  "عملي",
  "تمارين",
  "عيادة",
  "ستوديو",
  "مشروع",
  "حقلي",
  "تدريب",
]);

export function normalizeActivityTypes(values = []) {
  const present = new Set((values ?? []).map((value) => String(value ?? "").trim()));
  return ACTIVITY_TYPES.filter((activity) => present.has(activity));
}

export function matchingActivityAliases(activities, field) {
  const aliases = ACTIVITY_SOURCE_ALIASES[field] ?? [];
  const present = new Set((activities ?? []).map((activity) => String(activity ?? "").trim()));
  return aliases.filter((alias) => present.has(alias));
}

export const FALLBACK_FACT_FIELDS = Object.freeze([
  "name",
  "academicHours",
  ...ACTIVITY_FIELDS,
]);

export function normalizeActivityFacts(input = {}) {
  const value = { ...input };
  const known = ACTIVITY_FIELDS.filter((field) => numericValue(value[field]) !== null);
  if (!known.length) return { facts: value, normalizedFields: [], allUnknown: true };
  const normalizedFields = [];
  for (const field of ACTIVITY_FIELDS) {
    if (numericValue(value[field]) === null) {
      value[field] = 0;
      normalizedFields.push(field);
    } else {
      value[field] = numericValue(value[field]);
    }
  }
  return { facts: value, normalizedFields, allUnknown: false };
}

export function factualSnapshot(input = {}, provenance = "catalog") {
  const normalized = normalizeActivityFacts(input).facts;
  return Object.fromEntries(FALLBACK_FACT_FIELDS.map((field) => [
    field,
    normalized[field] ?? null,
  ]).concat([["provenance", provenance]]));
}
