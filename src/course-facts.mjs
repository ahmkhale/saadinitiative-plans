import { numericValue } from "./normalize.mjs";

export const ACTIVITY_FIELDS = Object.freeze([
  "lectureHours",
  "exerciseHours",
  "practicalHours",
]);

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

