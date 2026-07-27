import { addDiagnostic } from "../domain/diagnostics.mjs";
import { assertStableId } from "../domain/ids.mjs";
import { labelSemesters } from "../domain/semester.mjs";
import { normalizeSharedScope } from "../domain/shared-scope.mjs";
import { normalizePlanInput } from "./normalize-plan-input.mjs";

export function normalizeSharedSemesterSource(input, forcedId = null) {
  const id = assertStableId(forcedId ?? input?.id, "sharedSemesterSetId");
  const name = String(input?.name ?? "").trim();
  if (!name) throw new Error("اسم مجموعة الفصول مطلوب.");
  const normalized = normalizePlanInput({
    schemaVersion: 1,
    major: name,
    semesters: input?.semesters ?? [],
    fallbackCourses: input?.fallbackCourses ?? {},
  });
  if (!normalized.semesters.length) throw new Error("يجب أن تضم مجموعة الفصول فصلًا واحدًا على الأقل.");
  return {
    schemaVersion: 1,
    id,
    name,
    phaseLabel: String(input?.phaseLabel ?? name).trim(),
    semesters: normalized.semesters.map((semester) => {
      const value = structuredClone(semester);
      delete value.number;
      delete value.name;
      delete value.yearLabel;
      return value;
    }),
    fallbackCourses: structuredClone(input?.fallbackCourses ?? {}),
    scope: normalizeSharedScope(input?.scope),
  };
}

export function composeSharedSemesterSets(plan, sets, diagnostics) {
  const selected = plan.sharedSemesterSets ?? [];
  if (!selected.length) return plan;
  const inherited = [];
  const inheritedFallbacks = {};
  const phases = [];
  for (const id of selected) {
    const set = sets.get(id);
    if (!set) {
      addDiagnostic(diagnostics, "errors", "BROKEN_SHARED_SEMESTER_SET", `Shared semester set '${id}' was not found.`, { sharedSemesterSet: id });
      continue;
    }
    const start = inherited.length + 1;
    inherited.push(...set.semesters.map((semester, index) => ({
      ...structuredClone(semester),
      id: `shared-${set.id}-${semester.id ?? `level-${index + 1}`}`,
      inheritedFrom: set.id,
      inheritedName: set.name,
    })));
    Object.assign(inheritedFallbacks, structuredClone(set.fallbackCourses ?? {}));
    phases.push({ label: set.phaseLabel, start, end: inherited.length });
  }
  const ownStart = inherited.length + 1;
  const ownSemesters = plan.semesters.map((semester) => structuredClone(semester));
  const semesters = labelSemesters([...inherited, ...ownSemesters]);
  return {
    ...plan,
    semesters,
    fallbackCourses: { ...inheritedFallbacks, ...(plan.fallbackCourses ?? {}) },
    phases: ownSemesters.length
      ? [...phases, { label: "التخصص", start: ownStart, end: semesters.length }]
      : phases,
  };
}
