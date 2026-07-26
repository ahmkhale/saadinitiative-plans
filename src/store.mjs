import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizePlanInput, validatePlanShape } from "./plan-input.mjs";

const thisFile = fileURLToPath(import.meta.url);
export const projectRoot = path.resolve(path.dirname(thisFile), "..");
export const collegesRoot = path.resolve(process.env.SAAD_PLANS_COLLEGES_DIR ?? path.join(projectRoot, "colleges"));

export function assertSafeId(value, field = "id") {
  const id = String(value ?? "").trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,62})$/u.test(id)) {
    throw new Error(`${field} must use lowercase letters, numbers, and single hyphens only.`);
  }
  return id;
}

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

function initialPlan(college, input) {
  const id = assertSafeId(input?.id, "majorId");
  const major = String(input?.major ?? input?.name ?? "").trim();
  if (!major) throw new Error("Major name is required.");
  return {
    schemaVersion: 1,
    id,
    university: String(input?.university ?? "جامعة الملك سعود").trim(),
    college: college.name,
    major,
    degree: String(input?.degree ?? "البكالوريوس").trim(),
    edition: String(input?.edition ?? "الطبعة الأولى").trim(),
    release: String(input?.release ?? "إصدار 1.0").trim(),
    expectedCredits: Number(input?.expectedCredits ?? 0),
    semesters: [{ number: 1, name: "المستوى الأول", courses: [] }],
    electiveGroups: [],
    fallbackCourses: {},
  };
}

function validatePersistedPlan(plan) {
  const normalized = normalizePlanInput(plan);
  validatePlanShape(normalized);
  return plan;
}

export function createPlanStore(root = collegesRoot) {
  const collegeDir = (collegeId) => path.join(root, assertSafeId(collegeId, "collegeId"));
  const collegeFile = (collegeId) => path.join(collegeDir(collegeId), "college.json");
  const majorDir = (collegeId, majorId) => path.join(collegeDir(collegeId), assertSafeId(majorId, "majorId"));
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
    fs.mkdirSync(dir, { recursive: true });
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
    for (const major of listMajors(college.id)) {
      const plan = getPlan(college.id, major.id);
      if (plan.college !== college.name) savePlan(college.id, major.id, { ...plan, college: college.name });
    }
    return getCollege(college.id);
  }

  function deleteCollege(id) {
    const dir = collegeDir(id);
    if (!fs.existsSync(dir)) throw new Error(`College not found: ${id}`);
    fs.rmSync(dir, { recursive: true, force: true });
  }

  function listMajors(collegeId) {
    const dir = collegeDir(collegeId);
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
    const college = getCollege(collegeId);
    const plan = initialPlan(college, input);
    const filePath = planFile(college.id, plan.id);
    if (fs.existsSync(filePath)) throw new Error(`Major already exists: ${plan.id}`);
    validatePersistedPlan(plan);
    atomicWriteJson(filePath, plan);
    return plan;
  }

  function savePlan(collegeId, majorId, input) {
    const college = getCollege(collegeId);
    const currentId = assertSafeId(majorId, "majorId");
    const nextId = assertSafeId(input?.id ?? currentId, "majorId");
    const currentDir = majorDir(college.id, currentId);
    if (!fs.existsSync(currentDir)) throw new Error(`Major not found: ${currentId}`);
    const plan = {
      ...structuredClone(input),
      schemaVersion: 1,
      id: nextId,
      college: input.college || college.name,
    };
    validatePersistedPlan(plan);
    if (nextId !== currentId) {
      const nextDir = majorDir(college.id, nextId);
      if (fs.existsSync(nextDir)) throw new Error(`Major already exists: ${nextId}`);
      fs.renameSync(currentDir, nextDir);
    }
    atomicWriteJson(planFile(college.id, nextId), plan);
    return plan;
  }

  function duplicateMajor(collegeId, majorId, input) {
    const source = getPlan(collegeId, majorId);
    const nextId = assertSafeId(input?.id, "majorId");
    const copy = {
      ...structuredClone(source),
      id: nextId,
      major: String(input?.major ?? `${source.major} - نسخة`).trim(),
    };
    if (fs.existsSync(planFile(collegeId, nextId))) throw new Error(`Major already exists: ${nextId}`);
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

export const defaultPlanStore = createPlanStore();
