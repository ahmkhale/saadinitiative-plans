import path from "node:path";
import { normalizeSharedElectiveSource } from "../../application/shared-elective-source.mjs";
import { hydrateFallbackCourses } from "../../application/hydrate-fallbacks.mjs";
import { createJsonSourceRepository } from "./json-source-repository.mjs";
import { projectRoot } from "./plan-repository.mjs";

export const sharedElectiveGroupsRoot = path.resolve(
  process.env.SAAD_PLANS_SHARED_ELECTIVES_DIR
    ?? path.join(projectRoot, "institutions", "ksu", "shared-elective-sources"),
);

export function loadSharedElectiveGroups(root = sharedElectiveGroupsRoot) {
  return createJsonSourceRepository({
    root,
    idField: "sharedElectiveGroupId",
    entityName: "Shared elective source",
    clean: normalizeSharedElectiveSource,
  }).load();
}

export function createSharedElectiveGroupStore(options = {}) {
  const root = path.resolve(options.root ?? sharedElectiveGroupsRoot);
  const planStore = options.planStore;
  const catalogService = options.catalogService;
  const usages = (id) => {
    if (!planStore) return [];
    return planStore.listColleges().flatMap((college) => college.majors.flatMap((major) => {
      const plan = planStore.getPlan(college.id, major.id);
      return (plan.electiveGroups ?? []).some((group) => group.sourceId === id)
        ? [{ collegeId: college.id, college: college.name, majorId: major.id, major: major.major }]
        : [];
    }));
  };
  return createJsonSourceRepository({
    root,
    idField: "sharedElectiveGroupId",
    entityName: "Shared elective source",
    clean: normalizeSharedElectiveSource,
    usages,
    beforeSave: (value) => catalogService
      ? hydrateFallbackCourses(value, catalogService.snapshot().catalog, {
        codes: value.courses.map((entry) => typeof entry === "string" ? entry : entry.code),
      }).value
      : value,
    duplicateValue: (source, input) => ({
      ...source,
      ...input,
      courses: structuredClone(source.courses),
      fallbackCourses: structuredClone(source.fallbackCourses),
    }),
  });
}
