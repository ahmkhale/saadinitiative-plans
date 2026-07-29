import { atomicWriteJson } from "./plan-repository.mjs";

function canonicalSubjects(values) {
  return Array.from(new Set((values ?? []).map((value) => String(value).trim()).filter(Boolean)));
}

export function saveCourseColorAliases(input, filePath) {
  const subjects = canonicalSubjects(input.subjects);
  const previousSubjects = canonicalSubjects(input.previousSubjects);
  const color = String(input.color ?? "").toUpperCase();
  if (!subjects.length) throw new Error("At least one course subject keyword is required.");
  if (!/^#[0-9A-F]{6}$/u.test(color)) throw new Error("Color must be a six-digit hex value.");

  const colors = { ...(input.colors ?? {}) };
  for (const subject of previousSubjects) {
    if (!subjects.includes(subject)) delete colors[subject];
  }
  for (const subject of subjects) colors[subject] = color;
  if (!colors.عام) colors.عام = "#616161";
  atomicWriteJson(filePath, colors);
  return colors;
}
