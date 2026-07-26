import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCourseCatalog } from "./catalog.mjs";
import { courseCodeKey, courseSubject, normalizeCourseCode } from "./normalize.mjs";

const thisFile = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(thisFile), "..");

function readJson(filePath, fallback) {
  return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, "utf8")) : fallback;
}

function comparable(course) {
  return JSON.stringify({
    name: course?.name ?? null,
    academicHours: course?.academicHours ?? null,
    lectureHours: course?.lectureHours ?? null,
    practicalHours: course?.practicalHours ?? null,
    exerciseHours: course?.exerciseHours ?? null,
  });
}

export function createCatalogService(options = {}) {
  const malePath = path.resolve(options.malePath ?? path.join(projectRoot, "data", "courses", "Male", "courses.json"));
  const femalePath = path.resolve(options.femalePath ?? path.join(projectRoot, "data", "courses", "Female", "courses.json"));
  const colorsPath = path.resolve(options.colorsPath ?? path.join(projectRoot, "data", "course-colors.json"));

  function load() {
    const male = buildCourseCatalog(readJson(malePath, []));
    const female = buildCourseCatalog(readJson(femalePath, []));
    const catalog = new Map(female);
    for (const [key, value] of male) catalog.set(key, value);
    const conflicts = [];
    for (const [key, maleCourse] of male) {
      const femaleCourse = female.get(key);
      if (femaleCourse && comparable(maleCourse) !== comparable(femaleCourse)) {
        conflicts.push({
          code: maleCourse.code,
          male: maleCourse,
          female: femaleCourse,
        });
      }
    }
    return {
      catalog,
      colors: readJson(colorsPath, { عام: "#616161" }),
      conflicts,
      sources: [
        { role: "primary", path: malePath, exists: fs.existsSync(malePath), modifiedAt: fs.existsSync(malePath) ? fs.statSync(malePath).mtime.toISOString() : null, courseCount: male.size },
        { role: "fallback", path: femalePath, exists: fs.existsSync(femalePath), modifiedAt: fs.existsSync(femalePath) ? fs.statSync(femalePath).mtime.toISOString() : null, courseCount: female.size },
      ],
    };
  }

  function snapshot() {
    return load();
  }

  function summary() {
    const state = load();
    return {
      sources: state.sources,
      resolvedCourseCount: state.catalog.size,
      conflictCount: state.conflicts.length,
      conflicts: state.conflicts.slice(0, 50),
    };
  }

  function resolve(code) {
    const state = load();
    const normalizedCode = normalizeCourseCode(code);
    const course = state.catalog.get(courseCodeKey(normalizedCode));
    if (!course) return { found: false, code: normalizedCode };
    const subject = courseSubject(normalizedCode);
    return {
      found: true,
      ...course,
      subject,
      color: course.color ?? state.colors[subject] ?? state.colors[course.category] ?? state.colors.عام ?? "#616161",
    };
  }

  function search(query, limit = 40) {
    const state = load();
    const needle = String(query ?? "").trim().toLocaleLowerCase("ar");
    const results = [];
    for (const course of state.catalog.values()) {
      if (needle && !`${course.code} ${course.name ?? ""}`.toLocaleLowerCase("ar").includes(needle)) continue;
      results.push(resolve(course.code));
      if (results.length >= Math.min(100, Math.max(1, limit))) break;
    }
    return results;
  }

  return { malePath, femalePath, colorsPath, snapshot, summary, resolve, search };
}

export const defaultCatalogService = createCatalogService();
