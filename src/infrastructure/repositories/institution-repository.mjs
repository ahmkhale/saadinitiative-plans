import fs from "node:fs";
import path from "node:path";
import {
  assertSafeId,
  atomicWriteJson,
  createPlanStore,
  projectRoot,
} from "./plan-repository.mjs";
import { defaultCatalogService } from "../../catalog-service.mjs";

export const institutionsRoot = path.resolve(
  process.env.SAAD_PLANS_INSTITUTIONS_DIR ?? path.join(projectRoot, "institutions"),
);

export function metadataForPlanPath(planPath, root = institutionsRoot) {
  const relative = path.relative(root, path.resolve(planPath));
  const segments = relative.split(path.sep);
  if (
    segments.length < 6
    || segments[1] !== "colleges"
    || segments[3] !== "majors"
    || segments.at(-1) !== "plan.json"
  ) {
    return {};
  }
  const institutionId = assertSafeId(segments[0], "institutionId");
  const collegeId = assertSafeId(segments[2], "collegeId");
  const institution = cleanInstitution(readJson(path.join(root, institutionId, "institution.json")));
  const college = readJson(path.join(root, institutionId, "colleges", collegeId, "college.json"));
  return {
    institutionId,
    collegeId,
    university: institution.name,
    college: String(college.name ?? "").trim(),
    settingsPath: path.join(root, institutionId, "settings.json"),
    sharedSetsRoot: path.join(root, institutionId, "shared-semester-sources"),
    sharedElectivesRoot: path.join(root, institutionId, "shared-elective-sources"),
  };
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function cleanInstitution(input, forcedId = null) {
  const id = assertSafeId(forcedId ?? input?.id, "institutionId");
  const name = String(input?.name ?? "").trim();
  if (!name) throw new Error("Institution name is required.");
  return { id, name };
}

export function createInstitutionRepository(root = institutionsRoot, options = {}) {
  const institutionDir = (id) => path.join(root, assertSafeId(id, "institutionId"));
  const institutionFile = (id) => path.join(institutionDir(id), "institution.json");
  const collegesDir = (id) => path.join(institutionDir(id), "colleges");
  const planStore = (id) => createPlanStore(collegesDir(id), {
    catalogService: options.catalogService,
  });

  function get(id) {
    const institution = cleanInstitution(readJson(institutionFile(id)), id);
    return { ...institution, colleges: planStore(institution.id).listColleges() };
  }

  function list() {
    if (!fs.existsSync(root)) return [];
    return fs.readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && fs.existsSync(institutionFile(entry.name)))
      .map((entry) => get(entry.name))
      .sort((a, b) => a.name.localeCompare(b.name, "ar"));
  }

  function create(input) {
    const institution = cleanInstitution(input);
    const dir = institutionDir(institution.id);
    if (fs.existsSync(dir)) throw new Error(`Institution already exists: ${institution.id}`);
    fs.mkdirSync(collegesDir(institution.id), { recursive: true });
    atomicWriteJson(institutionFile(institution.id), institution);
    return get(institution.id);
  }

  function update(id, input) {
    const currentId = assertSafeId(id, "institutionId");
    if (!fs.existsSync(institutionFile(currentId))) {
      throw new Error(`Institution not found: ${currentId}`);
    }
    const institution = cleanInstitution(input, input?.id ?? currentId);
    if (institution.id !== currentId) {
      if (fs.existsSync(institutionDir(institution.id))) {
        throw new Error(`Institution already exists: ${institution.id}`);
      }
      fs.renameSync(institutionDir(currentId), institutionDir(institution.id));
    }
    atomicWriteJson(institutionFile(institution.id), institution);
    return get(institution.id);
  }

  function remove(id) {
    const dir = institutionDir(id);
    if (!fs.existsSync(dir)) throw new Error(`Institution not found: ${id}`);
    fs.rmSync(dir, { recursive: true, force: true });
  }

  function metadata(institutionId, collegeId) {
    const institution = get(institutionId);
    const college = planStore(institution.id).getCollege(collegeId);
    return { university: institution.name, college: college.name };
  }

  return {
    root,
    list,
    get,
    create,
    update,
    remove,
    planStore,
    metadata,
    institutionPath: institutionFile,
    settingsPath: (id) => path.join(institutionDir(id), "settings.json"),
    sharedSemesterSourcesRoot: (id) => path.join(institutionDir(id), "shared-semester-sources"),
    sharedElectiveSourcesRoot: (id) => path.join(institutionDir(id), "shared-elective-sources"),
  };
}

export const defaultInstitutionRepository = createInstitutionRepository(institutionsRoot, {
  catalogService: defaultCatalogService,
});
