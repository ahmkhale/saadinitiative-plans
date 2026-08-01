import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createCatalogService } from "../src/catalog-service.mjs";
import { createDiagnostics } from "../src/diagnostics.mjs";
import { normalizePlanInput } from "../src/plan-input.mjs";
import { resolvePlan } from "../src/resolve.mjs";
import { createPlanStore } from "../src/store.mjs";
import { courseCodeKey } from "../src/normalize.mjs";

test("save hydrates a durable fallback and preserves it after catalog removal", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "saad-hydration-"));
  try {
    const malePath = path.join(root, "male.json");
    const femalePath = path.join(root, "female.json");
    const colorsPath = path.join(root, "colors.json");
    fs.writeFileSync(malePath, JSON.stringify([
      { code: "101 عال", name: "مقدمة البرمجة", academicHours: 3, lectureHours: 3, activityTypes: ["محاضرة"] },
    ]));
    fs.writeFileSync(femalePath, "[]");
    fs.writeFileSync(colorsPath, JSON.stringify({ عام: "#616161" }));
    const catalogService = createCatalogService({ malePath, femalePath, colorsPath });
    const store = createPlanStore(path.join(root, "colleges"), { catalogService });
    store.createCollege({ id: "ccis", name: "الحاسب" });
    const plan = store.createMajor("ccis", { id: "cs", major: "علوم الحاسب" });
    plan.semesters[0].courses = [{ code: "101 عال" }];
    store.savePlan("ccis", "cs", plan);
    const saved = store.getPlan("ccis", "cs");
    const savedCourse = saved.fallbackCourses["101 عال"];
    assert.deepEqual(
      {
        name: savedCourse.name,
        academicHours: savedCourse.academicHours,
        lectureHours: savedCourse.lectureHours,
        exerciseHours: savedCourse.exerciseHours,
        practicalHours: savedCourse.practicalHours,
      },
      { name: "مقدمة البرمجة", academicHours: 3, lectureHours: 3, exerciseHours: 0, practicalHours: 0 },
    );
    assert.equal(savedCourse.source, "catalog");
    assert.deepEqual(savedCourse.manuallyEditedFields, []);
    assert.deepEqual(savedCourse.activityTypes, ["محاضرة"]);

    fs.writeFileSync(malePath, "[]");
    const diagnostics = createDiagnostics();
    const resolved = resolvePlan(
      normalizePlanInput(saved),
      catalogService.snapshot().catalog,
      { عام: "#616161" },
      diagnostics,
    );
    assert.equal(resolved.semesters[0].courses[0].name, "مقدمة البرمجة");
    assert.deepEqual(
      ["academicHours", "lectureHours", "exerciseHours", "practicalHours"].map((field) => resolved.semesters[0].courses[0][field]),
      [3, 3, 0, 0],
    );
    assert.deepEqual(resolved.activityTypes, ["محاضرة"]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("save-time hydration does not overwrite manual non-empty fields", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "saad-manual-hydration-"));
  try {
    const service = {
      snapshot: () => ({
        catalog: new Map([[courseCodeKey("101 عال"), {
          code: "101 عال",
          name: "اسم الدليل",
          academicHours: 3,
          lectureHours: 3,
          exerciseHours: 0,
          practicalHours: 0,
        }]]),
      }),
    };
    const store = createPlanStore(path.join(root, "colleges"), { catalogService: service });
    store.createCollege({ id: "ccis", name: "الحاسب" });
    const plan = store.createMajor("ccis", { id: "cs", major: "علوم الحاسب" });
    plan.semesters[0].courses = [{ code: "101 عال" }];
    plan.fallbackCourses = {
      "101 عال": { name: "اسم يدوي", source: "manual", manuallyEditedFields: ["name"] },
    };
    store.savePlan("ccis", "cs", plan);
    const saved = store.getPlan("ccis", "cs").fallbackCourses["101 عال"];
    assert.equal(saved.name, "اسم يدوي");
    assert.deepEqual(saved.manuallyEditedFields, ["name"]);
    assert.equal(saved.exerciseHours, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
