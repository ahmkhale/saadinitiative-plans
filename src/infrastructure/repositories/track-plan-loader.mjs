import fs from "node:fs";
import path from "node:path";
import { deriveTrackSpecificCourses } from "../../domain/tracks.mjs";
import { readJson } from "../fs/file-io.mjs";

function childTrackFiles(majorDir) {
  const root = path.join(majorDir, "tracks");
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(root, entry.name, "plan.json")))
    .map((entry) => path.join(root, entry.name, "plan.json"));
}

export function readPlanWithDerivedTrackStatus(planPath) {
  const resolvedPath = path.resolve(planPath);
  const trackDirectory = path.dirname(resolvedPath);
  const isChildTrack = path.basename(path.dirname(trackDirectory)) === "tracks";
  const majorDir = isChildTrack ? path.dirname(path.dirname(trackDirectory)) : trackDirectory;
  const rootPlanPath = path.join(majorDir, "plan.json");
  if (!fs.existsSync(rootPlanPath)) return readJson(resolvedPath);
  const siblingPaths = [rootPlanPath, ...childTrackFiles(majorDir)];
  if (siblingPaths.length === 1) return readJson(resolvedPath);
  return deriveTrackSpecificCourses(
    readJson(resolvedPath),
    siblingPaths.map(readJson),
  );
}
