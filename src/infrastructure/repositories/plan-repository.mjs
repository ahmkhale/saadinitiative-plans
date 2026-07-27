import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizePlanInput, validatePlanShape } from "../../application/normalize-plan-input.mjs";
import { canonicalizePlanForStorage, preparePlanForEditor } from "../../application/plan-storage.mjs";
import { defaultCatalogService } from "../catalog/catalog-service.mjs";
import { hydrateFallbackCourses } from "../../application/hydrate-fallbacks.mjs";
import { assertStableId } from "../../domain/ids.mjs";

const thisFile = fileURLToPath(import.meta.url);
export const projectRoot = path.resolve(path.dirname(thisFile), "../../..");
export const collegesRoot = path.resolve(
  process.env.SAAD_PLANS_COLLEGES_DIR ?? path.join(projectRoot, "institutions", "ksu", "colleges"),
);

export const assertSafeId = assertStableId;

function readJson(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function atomicWriteJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`,
  );
  try {
    fs.writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    fs.renameSync(tempPath, filePath);
  } finally {
    if (fs.existsSync(tempPath)) fs.rmSync(tempPath, { force: true });
  }
}

function cleanCollege(input, forcedId = null) {
  const id = assertSafeId(forcedId ?? input?.id, "collegeId");
  const name = String(input?.name ?? "").trim();
  if (!name) throw new Error("College name is required.");
  return { id, name };
}

function initialPlan(input) {
  const id = assertSafeId(input?.id, "majorId");
  const major = String(input?.major ?? input?.name ?? "").trim();
  if (!major) throw new Error("Major name is required.");
  return {
    schemaVersion: 1,
    id,
    major,
    degree: String(input?.degree ?? "البكالوريوس").trim(),
    expectedCredits: Number(input?.expectedCredits ?? 0),
    sharedSemesterSets: [],
    semesters: [{ id: "published-level-1", courses: [] }],
    electiveGroups: [],
    fallbackCourses: {},
  };
}

function validatePersistedPlan(plan) {
  const normalized = normalizePlanInput(plan);
  validatePlanShape(normalized);
  return plan;
}

export function createPlanStore(root = collegesRoot, options = {}) {
  const catalogService = options.catalogService ?? null;
  const collegeDir = (collegeId) => path.join(root, assertSafeId(collegeId, "collegeId"));
  const collegeFile = (collegeId) => path.join(collegeDir(collegeId), "college.json");
  const majorsDir = (collegeId) => path.join(collegeDir(collegeId), "majors");
  const majorDir = (collegeId, majorId) => path.join(
    majorsDir(collegeId),
    assertSafeId(majorId, "majorId"),
  );
  const planFile = (collegeId, majorId) => path.join(majorDir(collegeId, majorId), "plan.json");

  function getCollege(id) {
    const college = cleanCollege(readJson(collegeFile(id)), id);
    return { ...college, majors: listMajors(id) };
  }

  function listColleges() {
    if (!fs.existsSync(root)) return [];
    return fs.readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && fs.existsSync(collegeFile(entry.name)))
      .map((entry) => getCollege(entry.name))
      .sort((a, b) => a.name.localeCompare(b.name, "ar"));
  }

  function createCollege(input) {
    const college = cleanCollege(input);
    const dir = collegeDir(college.id);
    if (fs.existsSync(dir)) throw new Error(`College already exists: ${college.id}`);
    fs.mkdirSync(majorsDir(college.id), { recursive: true });
    atomicWriteJson(collegeFile(college.id), college);
    return getCollege(college.id);
  }

  function updateCollege(id, input) {
    const currentId = assertSafeId(id, "collegeId");
    if (!fs.existsSync(collegeFile(currentId))) throw new Error(`College not found: ${currentId}`);
    const college = cleanCollege(input, input?.id ?? currentId);
    if (college.id !== currentId) {
      if (fs.existsSync(collegeDir(college.id))) throw new Error(`College already exists: ${college.id}`);
      fs.renameSync(collegeDir(currentId), collegeDir(college.id));
    }
    atomicWriteJson(collegeFile(college.id), college);
    return getCollege(college.id);
  }

  function deleteCollege(id) {
    const dir = collegeDir(id);
    if (!fs.existsSync(dir)) throw new Error(`College not found: ${id}`);
    fs.rmSync(dir, { recursive: true, force: true });
  }

  function listMajors(collegeId) {
    const dir = majorsDir(collegeId);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && fs.existsSync(planFile(collegeId, entry.name)))
      .map((entry) => {
        const plan = getPlan(collegeId, entry.name);
        return {
          id: entry.name,
          major: plan.major,
          degree: plan.degree,
          expectedCredits: plan.expectedCredits ?? null,
          semesterCount: plan.semesters?.length ?? 0,
          hasProposal: Boolean(plan.proposal),
        };
      })
      .sort((a, b) => a.major.localeCompare(b.major, "ar"));
  }

  function getPlan(collegeId, majorId) {
    return readJson(planFile(collegeId, majorId));
  }

  function createMajor(collegeId, input) {
    getCollege(collegeId);
    const plan = initialPlan(input);
    const filePath = planFile(collegeId, plan.id);
    if (fs.existsSync(filePath)) throw new Error(`Major already exists: ${plan.id}`);
    validatePersistedPlan(plan);
    atomicWriteJson(filePath, plan);
    return plan;
  }

  function savePlan(collegeId, majorId, input) {
    getCollege(collegeId);
    const currentId = assertSafeId(majorId, "majorId");
    const nextId = assertSafeId(input?.id ?? currentId, "majorId");
    const currentDir = majorDir(collegeId, currentId);
    if (!fs.existsSync(currentDir)) throw new Error(`Major not found: ${currentId}`);
    let plan = canonicalizePlanForStorage({
      ...structuredClone(input),
      schemaVersion: 1,
      id: nextId,
    });
    if (catalogService) {
      const editable = preparePlanForEditor(plan);
      plan = canonicalizePlanForStorage(
        hydrateFallbackCourses(editable, catalogService.snapshot().catalog).value,
      );
    }
    validatePersistedPlan(plan);
    if (nextId !== currentId) {
      const nextDir = majorDir(collegeId, nextId);
      if (fs.existsSync(nextDir)) throw new Error(`Major already exists: ${nextId}`);
      fs.renameSync(currentDir, nextDir);
    }
    atomicWriteJson(planFile(collegeId, nextId), plan);
    return plan;
  }

  function duplicateMajor(collegeId, majorId, input) {
    const source = getPlan(collegeId, majorId);
    const nextId = assertSafeId(input?.id, "majorId");
    const copy = canonicalizePlanForStorage({
      ...structuredClone(source),
      id: nextId,
      major: String(input?.major ?? `${source.major} - نسخة`).trim(),
    });
    if (fs.existsSync(planFile(collegeId, nextId))) {
      throw new Error(`Major already exists: ${nextId}`);
    }
    validatePersistedPlan(copy);
    atomicWriteJson(planFile(collegeId, nextId), copy);
    return copy;
  }

  function deleteMajor(collegeId, majorId) {
    const dir = majorDir(collegeId, majorId);
    if (!fs.existsSync(dir)) throw new Error(`Major not found: ${majorId}`);
    fs.rmSync(dir, { recursive: true, force: true });
  }

  return {
    root,
    listColleges,
    getCollege,
    createCollege,
    updateCollege,
    deleteCollege,
    listMajors,
    getPlan,
    createMajor,
    savePlan,
    duplicateMajor,
    deleteMajor,
    planPath: planFile,
  };
}

export const defaultPlanStore = createPlanStore(collegesRoot, {
  catalogService: defaultCatalogService,
});
