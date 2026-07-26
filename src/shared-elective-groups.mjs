import fs from "node:fs";
import path from "node:path";
import { addDiagnostic } from "./diagnostics.mjs";
import { hydrateFallbackCourses } from "./fallback-hydration.mjs";
import { normalizeCourseCode, numericValue } from "./normalize.mjs";
import { assertSafeId, atomicWriteJson, projectRoot } from "./store.mjs";

export const sharedElectiveGroupsRoot = path.resolve(
  process.env.SAAD_PLANS_SHARED_ELECTIVES_DIR
    ?? path.join(projectRoot, "data", "shared-elective-groups"),
);

function fileFor(root, id) {
  return path.join(root, `${assertSafeId(id, "sharedElectiveGroupId")}.json`);
}

function cleanSource(input, forcedId = null) {
  const id = assertSafeId(forcedId ?? input?.id, "sharedElectiveGroupId");
  const name = String(input?.name ?? "").trim();
  if (!name) throw new Error("اسم مجموعة المقررات الاختيارية مطلوب.");
  const requiredHours = numericValue(input?.requiredHours);
  if (requiredHours === null || requiredHours < 0) throw new Error("الساعات المطلوبة يجب أن تكون صفرًا أو أكثر.");
  return {
    schemaVersion: 1,
    id,
    name,
    requiredHours,
    courses: (input?.courses ?? []).map((entry) => {
      if (typeof entry === "string") return normalizeCourseCode(entry);
      return { ...entry, code: normalizeCourseCode(entry.code) };
    }),
    fallbackCourses: structuredClone(input?.fallbackCourses ?? {}),
  };
}

export function loadSharedElectiveGroups(root = sharedElectiveGroupsRoot) {
  const map = new Map();
  if (!fs.existsSync(root)) return map;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== ".json") continue;
    const value = cleanSource(JSON.parse(fs.readFileSync(path.join(root, entry.name), "utf8")));
    map.set(value.id, value);
  }
  return map;
}

export function composeSharedElectiveGroups(plan, sources, diagnostics) {
  const result = structuredClone(plan);
  result.electiveGroups = (result.electiveGroups ?? []).flatMap((group, index) => {
    if (!group?.sourceId) return [group];
    const source = sources.get(group.sourceId);
    if (!source) {
      addDiagnostic(diagnostics, "errors", "BROKEN_SHARED_ELECTIVE_REFERENCE", `Shared elective source '${group.sourceId}' was not found.`, {
        sourceId: group.sourceId,
        location: `elective-${index + 1}`,
      });
      return [];
    }
    return [{
      sourceId: source.id,
      sharedSource: true,
      name: source.name,
      requiredHours: source.requiredHours,
      originalRequiredHours: source.requiredHours,
      sortCourses: "code",
      courses: source.courses.map((entry) => {
        const normalized = typeof entry === "string" ? { code: entry } : structuredClone(entry);
        const fallback = source.fallbackCourses?.[normalized.code];
        return fallback ? { ...normalized, fallback: structuredClone(fallback) } : normalized;
      }),
    }];
  });
  return result;
}

export function createSharedElectiveGroupStore(options = {}) {
  const root = path.resolve(options.root ?? sharedElectiveGroupsRoot);
  const planStore = options.planStore;
  const catalogService = options.catalogService;

  function usages(id) {
    if (!planStore) return [];
    return planStore.listColleges().flatMap((college) => college.majors.flatMap((major) => {
      const plan = planStore.getPlan(college.id, major.id);
      return (plan.electiveGroups ?? []).some((group) => group.sourceId === id)
        ? [{ collegeId: college.id, college: college.name, majorId: major.id, major: major.major }]
        : [];
    }));
  }

  function list() {
    return [...loadSharedElectiveGroups(root).values()]
      .map((source) => ({ ...source, usages: usages(source.id) }))
      .sort((a, b) => a.name.localeCompare(b.name, "ar"));
  }

  function get(id) {
    const target = fileFor(root, id);
    if (!fs.existsSync(target)) throw new Error(`Shared elective source not found: ${id}`);
    return { ...cleanSource(JSON.parse(fs.readFileSync(target, "utf8")), id), usages: usages(id) };
  }

  function save(input, previousId = null) {
    let value = cleanSource(input);
    if (catalogService) value = hydrateFallbackCourses(value, catalogService.snapshot().catalog, {
      codes: value.courses.map((entry) => typeof entry === "string" ? entry : entry.code),
    }).value;
    const target = fileFor(root, value.id);
    if (previousId && previousId !== value.id) {
      const previous = fileFor(root, previousId);
      if (fs.existsSync(target)) throw new Error(`Shared elective source already exists: ${value.id}`);
      if (fs.existsSync(previous)) fs.renameSync(previous, target);
    }
    atomicWriteJson(target, value);
    return get(value.id);
  }

  function create(input) {
    if (fs.existsSync(fileFor(root, input?.id))) throw new Error(`Shared elective source already exists: ${input.id}`);
    return save(input);
  }

  function duplicate(id, input) {
    const source = get(id);
    return create({ ...source, ...input, courses: structuredClone(source.courses), fallbackCourses: structuredClone(source.fallbackCourses) });
  }

  function remove(id) {
    const usedBy = usages(id);
    if (usedBy.length) throw new Error(`Shared elective source '${id}' is used by ${usedBy.length} major(s).`);
    fs.rmSync(fileFor(root, id));
  }

  return { root, list, get, create, save, duplicate, remove, usages, load: () => loadSharedElectiveGroups(root) };
}

