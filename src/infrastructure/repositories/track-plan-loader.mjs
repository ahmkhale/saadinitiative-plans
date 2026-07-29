import fs from "node:fs";
import path from "node:path";
import {
  collectFallbackCourses,
  composeTrackPlan,
  deriveTrackSpecificCourses,
} from "../../domain/tracks.mjs";
import { readJson } from "../fs/file-io.mjs";

function childTrackFiles(majorDir) {
  const root = path.join(majorDir, "tracks");
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(root, entry.name, "plan.json")))
    .map((entry) => path.join(root, entry.name, "plan.json"));
}

function planFiles(root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name, "en"))
    .flatMap((entry) => {
      const entryPath = path.join(root, entry.name);
      if (entry.isDirectory()) return planFiles(entryPath);
      return entry.isFile() && entry.name === "plan.json" ? [entryPath] : [];
    });
}

export function readPlanWithDerivedTrackStatus(planPath) {
  const resolvedPath = path.resolve(planPath);
  const trackDirectory = path.dirname(resolvedPath);
  const isChildTrack = path.basename(path.dirname(trackDirectory)) === "tracks";
  const majorDir = isChildTrack ? path.dirname(path.dirname(trackDirectory)) : trackDirectory;
  const rootPlanPath = path.join(majorDir, "plan.json");
  if (!fs.existsSync(rootPlanPath)) return readJson(resolvedPath);
  const parent = readJson(rootPlanPath);
  if (!isChildTrack) return parent;
  const siblingPaths = childTrackFiles(majorDir);
  const siblingTracks = siblingPaths.map((filePath) => readJson(filePath));
  const collegesRoot = path.dirname(path.dirname(path.dirname(majorDir)));
  const parentWithInstitutionFallbacks = {
    ...parent,
    fallbackCourses: collectFallbackCourses([
      ...planFiles(collegesRoot).map((filePath) => readJson(filePath)),
      parent,
      ...siblingTracks,
    ]),
  };
  const selected = composeTrackPlan(parentWithInstitutionFallbacks, readJson(resolvedPath));
  return deriveTrackSpecificCourses(
    selected,
    siblingTracks.map((plan) => composeTrackPlan(parentWithInstitutionFallbacks, plan)),
    parent,
  );
}
