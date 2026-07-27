import path from "node:path";
import { normalizeSharedSemesterSource } from "../../application/shared-semester-source.mjs";
import { hydrateFallbackCourses } from "../../application/hydrate-fallbacks.mjs";
import { createJsonSourceRepository } from "./json-source-repository.mjs";
import { projectRoot } from "./plan-repository.mjs";

export const sharedSemesterSetsRoot = path.resolve(
  process.env.SAAD_PLANS_SHARED_SETS_DIR
    ?? path.join(projectRoot, "institutions", "ksu", "shared-semester-sources"),
);

export function loadSharedSemesterSets(root = sharedSemesterSetsRoot) {
  return createJsonSourceRepository({
    root,
    idField: "sharedSemesterSetId",
    entityName: "Shared semester set",
    clean: normalizeSharedSemesterSource,
  }).load();
}

export function createSharedSemesterSetStore(options = {}) {
  const root = path.resolve(options.root ?? sharedSemesterSetsRoot);
  const planStore = options.planStore;
  const catalogService = options.catalogService;
  const usages = (id) => {
    if (!planStore) return [];
    return planStore.listColleges().flatMap((college) => college.majors.flatMap((major) => {
      const plan = planStore.getPlan(college.id, major.id);
      return (plan.sharedSemesterSets ?? []).includes(id)
        ? [{ collegeId: college.id, college: college.name, majorId: major.id, major: major.major }]
        : [];
    }));
  };
  return createJsonSourceRepository({
    root,
    idField: "sharedSemesterSetId",
    entityName: "Shared semester set",
    clean: normalizeSharedSemesterSource,
    usages,
    beforeSave: (value) => catalogService
      ? hydrateFallbackCourses(value, catalogService.snapshot().catalog).value
      : value,
    duplicateValue: (source, input) => ({
      ...source,
      ...input,
      semesters: structuredClone(source.semesters),
      fallbackCourses: structuredClone(source.fallbackCourses),
    }),
  });
}
