import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCourseCatalog } from "./catalog-aggregator.mjs";
import { courseCodeKey, courseSubject, normalizeCourseCode } from "../../domain/course-code.mjs";
import { ACTIVITY_SOURCE_ALIASES, normalizeActivityTypes } from "../../domain/course-facts.mjs";

const thisFile = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(thisFile), "../../..");
const TERM_ID_PATTERN = /^\d{2}[12]$/u;

function readJson(filePath, fallback) {
  return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, "utf8")) : fallback;
}

const COMPOSABLE_FACT_FIELDS = Object.freeze([
  "name",
  "academicHours",
  "lectureHours",
  "practicalHours",
  "exerciseHours",
]);

function isPresent(value) {
  return value !== null && value !== undefined && value !== "";
}

function composeGenderCatalogFacts(maleCourse, femaleCourse, termId) {
  if (!maleCourse) return femaleCourse ? { ...femaleCourse } : null;
  if (!femaleCourse) return { ...maleCourse };
  const completedFromFemaleFields = [];
  const conflictingFields = [];
  const fieldSources = {};
  const result = { ...maleCourse };
  for (const field of COMPOSABLE_FACT_FIELDS) {
    const maleValue = maleCourse[field];
    const femaleValue = femaleCourse[field];
    if (isPresent(maleValue)) {
      fieldSources[field] = "male";
      if (isPresent(femaleValue) && maleValue !== femaleValue) {
        conflictingFields.push({ field, male: maleValue, female: femaleValue });
      }
    } else if (isPresent(femaleValue)) {
      result[field] = femaleValue;
      fieldSources[field] = "female";
      completedFromFemaleFields.push(field);
    }
  }
  result.catalogFieldSources = fieldSources;
  result.completedFromFemaleFields = completedFromFemaleFields;
  result.conflicts = [
    ...(maleCourse.conflicts ?? []),
    ...(femaleCourse.conflicts ?? []).filter((conflict) => completedFromFemaleFields.includes(conflict.field)),
  ];
  result.activityAliasConflicts = [
    ...(maleCourse.activityAliasConflicts ?? []),
    ...(femaleCourse.activityAliasConflicts ?? []).filter((conflict) => completedFromFemaleFields.includes(conflict.field)),
  ];
  result.activityTypes = normalizeActivityTypes([
    ...(maleCourse.activityTypes ?? []),
    ...completedFromFemaleFields.flatMap((field) => (
      (ACTIVITY_SOURCE_ALIASES[field] ?? []).filter((activity) => femaleCourse.activityTypes?.includes(activity))
    )),
  ]);
  if (conflictingFields.length) {
    result.crossSourceConflict = {
      code: maleCourse.code,
      termId,
      fields: conflictingFields,
      male: maleCourse,
      female: femaleCourse,
    };
  }
  return result;
}

function sourceBadge(course, activeTermId) {
  const source = course.catalogSource === "female" ? "دليل الطالبات" : "دليل الطلاب";
  const term = course.catalogTermId && course.catalogTermId !== activeTermId
    ? ` · ${course.catalogTermId}`
    : "";
  const completion = course.completedFromFemaleFields?.length
    ? " · استكمال من دليل الطالبات"
    : "";
  return `${source}${term}${completion}`;
}

function qualityBadges(course) {
  const result = [];
  if ((course?.conflicts?.length ?? 0) > 0
    || (course?.activityAliasConflicts?.length ?? 0) > 0
    || course?.crossSourceConflict) result.push("بيانات متعارضة");
  if (!course?.name || course?.academicHours === null || course?.academicHours === undefined
    || course?.lectureHours === null || course?.lectureHours === undefined
    || course?.exerciseHours === null || course?.exerciseHours === undefined
    || course?.practicalHours === null || course?.practicalHours === undefined) {
    result.push("بيانات ناقصة");
  }
  return result;
}

function dataQuality(course) {
  const badges = qualityBadges(course);
  if (badges.includes("بيانات متعارضة")) return "conflicting";
  if (badges.includes("بيانات ناقصة")) return "incomplete";
  return "complete";
}

export function catalogTermIds(institutionRoot, activeTermId) {
  if (!TERM_ID_PATTERN.test(activeTermId)) {
    throw new Error(`Catalog term must use YY1 or YY2 naming: ${activeTermId}`);
  }
  const activeNumber = Number(activeTermId);
  const historical = fs.existsSync(institutionRoot)
    ? fs.readdirSync(institutionRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && TERM_ID_PATTERN.test(entry.name))
      .map((entry) => entry.name)
      .filter((termId) => Number(termId) < activeNumber)
      .sort((left, right) => Number(right) - Number(left))
    : [];
  return [activeTermId, ...historical.filter((termId) => termId !== activeTermId)];
}

function tagCatalog(catalog, termId, active) {
  return new Map([...catalog].map(([key, course]) => [
    key,
    { ...course, catalogTermId: termId, catalogIsHistorical: !active },
  ]));
}

function loadCatalogTerm({ termId, malePath, femalePath, active }) {
  const male = tagCatalog(
    buildCourseCatalog(readJson(malePath, []), { catalogSource: "male" }),
    termId,
    active,
  );
  const female = tagCatalog(
    buildCourseCatalog(readJson(femalePath, []), { catalogSource: "female" }),
    termId,
    active,
  );
  const catalog = new Map([...female].map(([key, value]) => [key, { ...value }]));
  for (const [key, maleCourse] of male) {
    catalog.set(key, composeGenderCatalogFacts(maleCourse, female.get(key), termId));
  }
  const conflicts = [
    ...[...male.values()].flatMap((course) => (course.conflicts ?? []).map((conflict) => ({ code: course.code, termId, source: "male", ...conflict }))),
    ...[...female.values()].flatMap((course) => (course.conflicts ?? []).map((conflict) => ({ code: course.code, termId, source: "female", ...conflict }))),
    ...[...male.values()].flatMap((course) => (course.activityAliasConflicts ?? []).map((conflict) => ({ code: course.code, termId, source: "male", type: "activity-alias", ...conflict }))),
    ...[...female.values()].flatMap((course) => (course.activityAliasConflicts ?? []).map((conflict) => ({ code: course.code, termId, source: "female", type: "activity-alias", ...conflict }))),
  ];
  for (const [key, maleCourse] of male) {
    const femaleCourse = female.get(key);
    const conflict = catalog.get(key)?.crossSourceConflict;
    if (femaleCourse && conflict) conflicts.push(conflict);
  }
  return {
    termId,
    male,
    female,
    catalog,
    conflicts,
    sources: [
      {
        role: active ? "primary" : "historical-primary",
        termId,
        path: malePath,
        exists: fs.existsSync(malePath),
        modifiedAt: fs.existsSync(malePath) ? fs.statSync(malePath).mtime.toISOString() : null,
        courseCount: male.size,
      },
      {
        role: active ? "fallback" : "historical-fallback",
        termId,
        path: femalePath,
        exists: fs.existsSync(femalePath),
        modifiedAt: fs.existsSync(femalePath) ? fs.statSync(femalePath).mtime.toISOString() : null,
        courseCount: female.size,
      },
    ],
  };
}

export function createCatalogService(options = {}) {
  const institutionId = options.institutionId ?? "ksu";
  const catalogRoot = path.resolve(options.catalogRoot ?? path.join(projectRoot, "catalogs"));
  const institutionRoot = path.join(catalogRoot, institutionId);
  const activePath = path.resolve(options.activePath ?? path.join(institutionRoot, "active.json"));
  const explicitPaths = Boolean(options.malePath || options.femalePath);
  const termId = options.termId
    ?? (explicitPaths ? "custom" : readJson(activePath, {}).termId);
  if (!termId) throw new Error(`Active catalog term is missing: ${activePath}`);
  const termRoot = path.join(institutionRoot, termId);
  const malePath = path.resolve(options.malePath ?? path.join(termRoot, "male.json"));
  const femalePath = path.resolve(options.femalePath ?? path.join(termRoot, "female.json"));
  const colorsPath = path.resolve(options.colorsPath ?? path.join(projectRoot, "data", "course-colors.json"));

  function load() {
    const termIds = explicitPaths ? [termId] : catalogTermIds(institutionRoot, termId);
    const terms = termIds.map((catalogTermId, index) => {
      const active = index === 0;
      const catalogTermRoot = path.join(institutionRoot, catalogTermId);
      return loadCatalogTerm({
        termId: catalogTermId,
        malePath: active ? malePath : path.join(catalogTermRoot, "male.json"),
        femalePath: active ? femalePath : path.join(catalogTermRoot, "female.json"),
        active,
      });
    });
    const catalog = new Map();
    for (const term of terms) {
      for (const [key, course] of term.catalog) {
        if (!catalog.has(key)) catalog.set(key, { ...course });
      }
    }
    const activeTerm = terms[0];
    const conflicts = terms.flatMap((term) => term.conflicts);
    return {
      catalog,
      male: activeTerm.male,
      female: activeTerm.female,
      colors: readJson(colorsPath, { عام: "#616161" }),
      conflicts,
      sources: terms.flatMap((term) => term.sources),
      terms,
      institutionId,
      termId,
      termIds,
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
      institutionId: state.institutionId,
      termId: state.termId,
      termIds: state.termIds,
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
      sourceBadge: sourceBadge(course, state.termId),
      qualityBadges: qualityBadges(course),
      dataQuality: dataQuality(course),
      color: course.color ?? state.colors[subject] ?? state.colors[course.category] ?? state.colors.عام ?? "#616161",
    };
  }

  function search(query, limit = 40) {
    const state = load();
    const needle = String(query ?? "").trim().toLocaleLowerCase("ar");
    const results = [];
    for (const course of state.catalog.values()) {
      if (needle && !`${course.code} ${course.name ?? ""}`.toLocaleLowerCase("ar").includes(needle)) continue;
      const normalizedCode = normalizeCourseCode(course.code);
      const subject = courseSubject(normalizedCode);
      results.push({
        found: true,
        ...course,
        subject,
        sourceBadge: sourceBadge(course, state.termId),
        qualityBadges: qualityBadges(course),
        dataQuality: dataQuality(course),
        color: course.color ?? state.colors[subject] ?? state.colors[course.category] ?? state.colors.عام ?? "#616161",
      });
      if (results.length >= Math.min(100, Math.max(1, limit))) break;
    }
    return results;
  }

  return { institutionId, termId, activePath, malePath, femalePath, colorsPath, snapshot, summary, resolve, search };
}

export const defaultCatalogService = createCatalogService();
