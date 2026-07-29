import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizePlanInput, validatePlanShape } from "../../application/normalize-plan-input.mjs";
import { canonicalizePlanForStorage, preparePlanForEditor } from "../../application/plan-storage.mjs";
import { defaultCatalogService } from "../catalog/catalog-service.mjs";
import { hydrateFallbackCourses } from "../../application/hydrate-fallbacks.mjs";
import { assertStableId } from "../../domain/ids.mjs";
import {
  collectFallbackCourses,
  cleanTrack,
  composeTrackPlan,
  deriveTrackSpecificCourses,
} from "../../domain/tracks.mjs";

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
  const tracksDir = (collegeId, majorId) => path.join(majorDir(collegeId, majorId), "tracks");
  const childTrackFile = (collegeId, majorId, trackId) => path.join(
    tracksDir(collegeId, majorId),
    assertSafeId(trackId, "trackId"),
    "plan.json",
  );

  function listTracks(collegeId, majorId) {
    const rootPlan = readJson(planFile(collegeId, majorId));
    const childrenRoot = tracksDir(collegeId, majorId);
    return (!fs.existsSync(childrenRoot) ? [] : fs.readdirSync(childrenRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && fs.existsSync(childTrackFile(collegeId, majorId, entry.name)))
      .map((entry) => {
        const plan = readJson(childTrackFile(collegeId, majorId, entry.name));
        const composed = composeTrackPlan(rootPlan, plan);
        return {
          ...cleanTrack(plan.track, entry.name),
          semesterCount: composed.semesters?.length ?? 0,
          ownSemesterCount: plan.semesters?.length ?? 0,
          hasProposal: Boolean(composed.proposal),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "ar")));
  }

  function allTrackPlans(collegeId, majorId) {
    return listTracks(collegeId, majorId).map((track) => readJson(childTrackFile(
      collegeId,
      majorId,
      track.id,
    )));
  }

  function allInstitutionPlans() {
    if (!fs.existsSync(root)) return [];
    return fs.readdirSync(root, { withFileTypes: true })
      .filter((college) => college.isDirectory())
      .sort((left, right) => left.name.localeCompare(right.name, "en"))
      .flatMap((college) => {
        const rootMajors = majorsDir(college.name);
        if (!fs.existsSync(rootMajors)) return [];
        return fs.readdirSync(rootMajors, { withFileTypes: true })
          .filter((major) => major.isDirectory() && fs.existsSync(planFile(college.name, major.name)))
          .sort((left, right) => left.name.localeCompare(right.name, "en"))
          .flatMap((major) => [
            getPlan(college.name, major.name),
            ...allTrackPlans(college.name, major.name),
          ]);
      });
  }

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
          parent: {
            semesterCount: plan.semesters?.length ?? 0,
            hasProposal: Boolean(plan.proposal),
          },
          tracks: listTracks(collegeId, entry.name),
        };
      })
      .sort((a, b) => a.major.localeCompare(b.major, "ar"));
  }

  function getPlan(collegeId, majorId, trackId = null) {
    return readJson(trackId
      ? childTrackFile(collegeId, majorId, trackId)
      : planFile(collegeId, majorId));
  }

  function getPlanForEditor(collegeId, majorId, trackId = null, draft = null) {
    return preparePlanForEditor(draft ?? getPlan(collegeId, majorId, trackId));
  }

  function getComposedPlan(collegeId, majorId, trackId = null, draft = null) {
    const parent = preparePlanForEditor(
      !trackId && draft ? draft : getPlan(collegeId, majorId),
    );
    if (!trackId) {
      return {
        ...parent,
        fallbackCourses: collectFallbackCourses([
          ...allInstitutionPlans(),
          parent,
        ]),
      };
    }
    const selected = preparePlanForEditor(draft ?? getPlan(collegeId, majorId, trackId));
    const siblingTracks = allTrackPlans(collegeId, majorId).map((plan) => (
      plan.track?.id === trackId ? selected : preparePlanForEditor(plan)
    ));
    const parentWithInstitutionFallbacks = {
      ...parent,
      fallbackCourses: collectFallbackCourses([
        ...allInstitutionPlans(),
        parent,
        ...siblingTracks,
      ]),
    };
    const composedSiblings = siblingTracks.map((plan) => composeTrackPlan(
      parentWithInstitutionFallbacks,
      plan,
    ));
    return deriveTrackSpecificCourses(
      composeTrackPlan(parentWithInstitutionFallbacks, selected),
      composedSiblings,
      parent,
    );
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

  function savePlan(collegeId, majorId, input, trackId = null) {
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
    if (trackId && input?.track?.id && input.track.id !== trackId) {
      throw new Error("Track id cannot be changed from the plan form.");
    }
    if (nextId !== currentId) {
      const nextDir = majorDir(collegeId, nextId);
      if (fs.existsSync(nextDir)) throw new Error(`Major already exists: ${nextId}`);
      fs.renameSync(currentDir, nextDir);
    }
    const destination = trackId
      ? childTrackFile(collegeId, nextId, trackId)
      : planFile(collegeId, nextId);
    atomicWriteJson(destination, plan);
    for (const sibling of listTracks(collegeId, nextId)) {
      if (sibling.id === trackId) continue;
      const siblingPath = childTrackFile(collegeId, nextId, sibling.id);
      const siblingPlan = canonicalizePlanForStorage({
        ...readJson(siblingPath),
        id: nextId,
        major: plan.major,
        degree: plan.degree,
        expectedCredits: plan.expectedCredits,
      });
      atomicWriteJson(siblingPath, siblingPlan);
    }
    return plan;
  }

  function createTrack(collegeId, majorId, input) {
    const rootPlan = getPlan(collegeId, majorId);
    const track = cleanTrack(input);
    assertSafeId(track.id, "trackId");
    if (listTracks(collegeId, majorId).some((item) => item.id === track.id)) {
      throw new Error(`Track already exists: ${track.id}`);
    }
    const source = input?.sourceTrackId
      ? getPlan(collegeId, majorId, input.sourceTrackId)
      : {
        schemaVersion: 1,
        id: majorId,
        major: rootPlan.major,
        degree: rootPlan.degree,
        expectedCredits: rootPlan.expectedCredits ?? 0,
        sharedSemesterSets: [],
        semesters: [],
        electiveGroups: [],
        fallbackCourses: {},
      };
    const copy = canonicalizePlanForStorage({
      ...structuredClone(source),
      id: majorId,
      major: rootPlan.major,
      track,
    });
    validatePersistedPlan(copy);
    atomicWriteJson(childTrackFile(collegeId, majorId, track.id), copy);
    return copy;
  }

  function deleteTrack(collegeId, majorId, trackId) {
    const track = listTracks(collegeId, majorId).find((item) => item.id === trackId);
    if (!track) throw new Error(`Track not found: ${trackId}`);
    fs.rmSync(path.dirname(childTrackFile(collegeId, majorId, trackId)), { recursive: true, force: true });
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
    for (const track of listTracks(collegeId, majorId)) {
      const trackCopy = canonicalizePlanForStorage({
        ...getPlan(collegeId, majorId, track.id),
        id: nextId,
        major: copy.major,
        degree: copy.degree,
        expectedCredits: copy.expectedCredits,
      });
      validatePersistedPlan(trackCopy);
      atomicWriteJson(childTrackFile(collegeId, nextId, track.id), trackCopy);
    }
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
    listTracks,
    getPlan,
    getPlanForEditor,
    getComposedPlan,
    createMajor,
    savePlan,
    createTrack,
    deleteTrack,
    duplicateMajor,
    deleteMajor,
    planPath: planFile,
  };
}

export const defaultPlanStore = createPlanStore(collegesRoot, {
  catalogService: defaultCatalogService,
});
