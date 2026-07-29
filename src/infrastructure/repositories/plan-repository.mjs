import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizePlanInput, validatePlanShape } from "../../application/normalize-plan-input.mjs";
import { canonicalizePlanForStorage, preparePlanForEditor } from "../../application/plan-storage.mjs";
import { defaultCatalogService } from "../catalog/catalog-service.mjs";
import { hydrateFallbackCourses } from "../../application/hydrate-fallbacks.mjs";
import { assertStableId } from "../../domain/ids.mjs";
import { cleanTrack, deriveTrackSpecificCourses } from "../../domain/tracks.mjs";

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
    const rootTrack = rootPlan.track
      ? cleanTrack(rootPlan.track, assertSafeId(rootPlan.track.id, "trackId"))
      : { id: majorId, name: "الخطة العامة" };
    const childrenRoot = tracksDir(collegeId, majorId);
    const children = !fs.existsSync(childrenRoot) ? [] : fs.readdirSync(childrenRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && fs.existsSync(childTrackFile(collegeId, majorId, entry.name)))
      .map((entry) => {
        const plan = readJson(childTrackFile(collegeId, majorId, entry.name));
        return {
          ...cleanTrack(plan.track, entry.name),
          semesterCount: plan.semesters?.length ?? 0,
          hasProposal: Boolean(plan.proposal),
          isRoot: false,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "ar"));
    return [{
      ...rootTrack,
      semesterCount: rootPlan.semesters?.length ?? 0,
      hasProposal: Boolean(rootPlan.proposal),
      isRoot: true,
    }, ...children];
  }

  function trackFile(collegeId, majorId, trackId = null) {
    const rootPath = planFile(collegeId, majorId);
    if (!trackId) return rootPath;
    const rootPlan = readJson(rootPath);
    const rootTrackId = rootPlan.track?.id ?? majorId;
    return trackId === rootTrackId ? rootPath : childTrackFile(collegeId, majorId, trackId);
  }

  function allTrackPlans(collegeId, majorId) {
    return listTracks(collegeId, majorId).map((track) => readJson(trackFile(
      collegeId,
      majorId,
      track.id,
    )));
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
          tracks: listTracks(collegeId, entry.name),
        };
      })
      .sort((a, b) => a.major.localeCompare(b.major, "ar"));
  }

  function getPlan(collegeId, majorId, trackId = null) {
    return readJson(trackFile(collegeId, majorId, trackId));
  }

  function getPlanForEditor(collegeId, majorId, trackId = null, draft = null) {
    const selected = preparePlanForEditor(draft ?? getPlan(collegeId, majorId, trackId));
    const selectedTrackId = selected.track?.id ?? trackId ?? majorId;
    const siblings = allTrackPlans(collegeId, majorId).map((plan) => (
      (plan.track?.id ?? majorId) === selectedTrackId ? selected : plan
    ));
    return deriveTrackSpecificCourses(selected, siblings);
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
    const currentTrackId = trackId ?? getPlan(collegeId, currentId).track?.id ?? currentId;
    if (trackId && input?.track?.id && input.track.id !== trackId) {
      throw new Error("Track id cannot be changed from the plan form.");
    }
    if (nextId !== currentId) {
      const nextDir = majorDir(collegeId, nextId);
      if (fs.existsSync(nextDir)) throw new Error(`Major already exists: ${nextId}`);
      fs.renameSync(currentDir, nextDir);
    }
    const destination = trackFile(collegeId, nextId, currentTrackId);
    atomicWriteJson(destination, plan);
    for (const sibling of listTracks(collegeId, nextId)) {
      if (sibling.id === currentTrackId) continue;
      const siblingPath = trackFile(collegeId, nextId, sibling.id);
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
    const hadExplicitRootTrack = Boolean(rootPlan.track);
    const requestedSourceTrackId = input?.sourceTrackId;
    assertSafeId(track.id, "trackId");
    if (listTracks(collegeId, majorId).some((item) => item.id === track.id)) {
      throw new Error(`Track already exists: ${track.id}`);
    }
    if (!rootPlan.track) {
      rootPlan.track = cleanTrack({
        id: input?.rootTrackId ?? "general",
        name: input?.rootTrackName ?? "المسار العام",
      });
      assertSafeId(rootPlan.track.id, "trackId");
      atomicWriteJson(planFile(collegeId, majorId), canonicalizePlanForStorage(rootPlan));
    }
    if (track.id === rootPlan.track.id) throw new Error(`Track already exists: ${track.id}`);
    const sourceTrackId = !hadExplicitRootTrack && requestedSourceTrackId === majorId
      ? rootPlan.track.id
      : requestedSourceTrackId ?? rootPlan.track.id;
    const source = getPlan(collegeId, majorId, sourceTrackId);
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
    if (track.isRoot) throw new Error("The root track cannot be deleted.");
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
    for (const track of listTracks(collegeId, majorId).filter((item) => !item.isRoot)) {
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
