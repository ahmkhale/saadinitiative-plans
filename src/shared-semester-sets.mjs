import fs from "node:fs";
import path from "node:path";
import { addDiagnostic } from "./diagnostics.mjs";
import { normalizePlanInput } from "./plan-input.mjs";
import { labelSemesters } from "./semester-labels.mjs";
import { assertSafeId, atomicWriteJson, projectRoot } from "./store.mjs";
import { hydrateFallbackCourses } from "./fallback-hydration.mjs";
import { normalizeSharedScope } from "./domain/shared-scope.mjs";

export const sharedSemesterSetsRoot = path.resolve(
  process.env.SAAD_PLANS_SHARED_SETS_DIR
    ?? path.join(projectRoot, "institutions", "ksu", "shared-semester-sources"),
);

function fileFor(root, id) {
  return path.join(root, `${assertSafeId(id, "sharedSemesterSetId")}.json`);
}

function cleanSet(input, forcedId = null) {
  const id = assertSafeId(forcedId ?? input?.id, "sharedSemesterSetId");
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

export function loadSharedSemesterSets(root = sharedSemesterSetsRoot) {
  const result = new Map();
  if (!fs.existsSync(root)) return result;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const value = cleanSet(JSON.parse(fs.readFileSync(path.join(root, entry.name), "utf8")));
    result.set(value.id, value);
  }
  return result;
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

export function createSharedSemesterSetStore(options = {}) {
  const root = path.resolve(options.root ?? sharedSemesterSetsRoot);
  const planStore = options.planStore;
  const catalogService = options.catalogService;

  function usages(id) {
    if (!planStore) return [];
    return planStore.listColleges().flatMap((college) => college.majors.flatMap((major) => {
      const plan = planStore.getPlan(college.id, major.id);
      return (plan.sharedSemesterSets ?? []).includes(id)
        ? [{ collegeId: college.id, college: college.name, majorId: major.id, major: major.major }]
        : [];
    }));
  }

  function list() {
    return [...loadSharedSemesterSets(root).values()].map((set) => ({ ...set, usages: usages(set.id) }))
      .sort((a, b) => a.name.localeCompare(b.name, "ar"));
  }

  function get(id) {
    const filePath = fileFor(root, id);
    if (!fs.existsSync(filePath)) throw new Error(`Shared semester set not found: ${id}`);
    return { ...cleanSet(JSON.parse(fs.readFileSync(filePath, "utf8")), id), usages: usages(id) };
  }

  function save(input, previousId = null) {
    let value = cleanSet(input);
    if (catalogService) value = hydrateFallbackCourses(value, catalogService.snapshot().catalog).value;
    const target = fileFor(root, value.id);
    if (previousId && previousId !== value.id) {
      const previous = fileFor(root, previousId);
      if (fs.existsSync(target)) throw new Error(`Shared semester set already exists: ${value.id}`);
      if (fs.existsSync(previous)) fs.renameSync(previous, target);
    }
    atomicWriteJson(target, value);
    return get(value.id);
  }

  function create(input) {
    const target = fileFor(root, input?.id);
    if (fs.existsSync(target)) throw new Error(`Shared semester set already exists: ${input.id}`);
    return save(input);
  }

  function duplicate(id, input) {
    const source = get(id);
    return create({ ...source, ...input, semesters: structuredClone(source.semesters), fallbackCourses: structuredClone(source.fallbackCourses) });
  }

  function remove(id) {
    const usedBy = usages(id);
    if (usedBy.length) throw new Error(`Shared semester set '${id}' is used by ${usedBy.length} major(s).`);
    fs.rmSync(fileFor(root, id));
  }

  return { root, list, get, create, save, duplicate, remove, usages, load: () => loadSharedSemesterSets(root) };
}
