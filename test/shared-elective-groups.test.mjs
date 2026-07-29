import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildCourseCatalog } from "../src/catalog.mjs";
import { createDiagnostics } from "../src/diagnostics.mjs";
import { normalizePlanInput } from "../src/plan-input.mjs";
import { resolvePlan } from "../src/resolve.mjs";
import {
  composeSharedElectiveGroups,
  createSharedElectiveGroupStore,
  loadSharedElectiveGroups,
} from "../src/shared-elective-groups.mjs";
import { createPlanStore } from "../src/store.mjs";

const facts = (name) => ({ name, academicHours: 2, lectureHours: 2, exerciseHours: 0, practicalHours: 0 });

function resolveWithExclusions(count, duplicate = false) {
  const codes = ["100 سلم", "101 سلم", "102 سلم", "103 سلم"];
  const semesterCourses = codes.slice(0, count);
  if (duplicate && semesterCourses.length) semesterCourses.push(semesterCourses[0]);
  const plan = normalizePlanInput({
    schemaVersion: 1,
    major: "اختبار",
    semesters: [{ courses: semesterCourses }],
    electiveGroups: [{ sourceId: "university" }],
    fallbackCourses: Object.fromEntries(codes.map((code) => [code, facts(code)])),
  });
  const sources = new Map([["university", {
    schemaVersion: 1,
    id: "university",
    name: "متطلبات الجامعة",
    requiredHours: 8,
    courses: codes,
    fallbackCourses: Object.fromEntries(codes.map((code) => [code, facts(code)])),
  }]]);
  const diagnostics = createDiagnostics();
  const composed = composeSharedElectiveGroups(plan, sources, diagnostics);
  return { resolved: resolvePlan(composed, new Map(), { عام: "#616161" }, diagnostics), diagnostics };
}

function resolveWithoutExclusions() {
  const codes = ["100 سلم", "101 سلم"];
  const plan = normalizePlanInput({
    schemaVersion: 1,
    major: "اختبار",
    semesters: [{ courses: ["100 سلم"] }],
    electiveGroups: [{ sourceId: "university" }],
    fallbackCourses: Object.fromEntries(codes.map((code) => [code, facts(code)])),
  });
  const sources = new Map([["university", {
    schemaVersion: 1,
    id: "university",
    name: "متطلبات الجامعة",
    requiredHours: 8,
    excludePublishedCourses: false,
    courses: codes,
    fallbackCourses: Object.fromEntries(codes.map((code) => [code, facts(code)])),
  }]]);
  const diagnostics = createDiagnostics();
  const composed = composeSharedElectiveGroups(plan, sources, diagnostics);
  return resolvePlan(composed, new Map(), { عام: "#616161" }, diagnostics);
}

test("shared university requirements subtract distinct published courses", () => {
  assert.equal(resolveWithExclusions(0).resolved.electiveGroups[0].requiredHours, 8);
  assert.equal(resolveWithExclusions(1).resolved.electiveGroups[0].requiredHours, 6);
  assert.equal(resolveWithExclusions(2).resolved.electiveGroups[0].requiredHours, 4);
  assert.equal(resolveWithExclusions(1, true).resolved.electiveGroups[0].requiredHours, 6);
  assert.equal(resolveWithExclusions(4).resolved.electiveGroups.length, 0);
});

test("shared elective subtraction uses the owning fallback hours when the active catalog differs", () => {
  const plan = normalizePlanInput({
    schemaVersion: 1,
    major: "اختبار",
    semesters: [{ courses: ["107 سلم"] }],
    electiveGroups: [{
      id: "university",
      name: "متطلبات الجامعة",
      sharedSource: true,
      requiredHours: 8,
      originalRequiredHours: 8,
      courses: ["107 سلم", "108 سلم"],
    }],
    fallbackCourses: {
      "107 سلم": {
        name: "أخلاقيات المهنة",
        academicHours: 2,
        lectureHours: 2,
        exerciseHours: 0,
        practicalHours: 0,
        source: "catalog",
      },
      "108 سلم": {
        name: "قضايا معاصرة",
        academicHours: 2,
        lectureHours: 2,
        exerciseHours: 0,
        practicalHours: 0,
      },
    },
  });
  const catalog = buildCourseCatalog([{
    code: "107 سلم",
    name: "أخلاقيات المهنة",
    academicHours: 3,
    lectureHours: 3,
    exerciseHours: 0,
    practicalHours: 0,
  }]);

  const resolved = resolvePlan(plan, catalog, {}, createDiagnostics());

  assert.equal(resolved.publishedHours, 3);
  assert.equal(resolved.electiveGroups[0].requiredHours, 6);
  assert.equal(resolved.totalHours, 9);
});

test("shared elective sources can keep courses that are already published", () => {
  const group = resolveWithoutExclusions().electiveGroups[0];
  assert.equal(group.requiredHours, 8);
  assert.deepEqual(group.excludedCourses, []);
  assert.deepEqual(group.courses.map((course) => course.code), ["100 سلم", "101 سلم"]);
});

test("shared elective edits propagate and referenced sources cannot be deleted", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "saad-shared-elective-"));
  try {
    const planStore = createPlanStore(path.join(root, "colleges"));
    planStore.createCollege({ id: "science", name: "العلوم" });
    const plan = planStore.createMajor("science", { id: "math", major: "الرياضيات" });
    plan.electiveGroups = [{ sourceId: "university" }];
    planStore.savePlan("science", "math", plan);
    const store = createSharedElectiveGroupStore({ root: path.join(root, "sources"), planStore });
    store.create({
      id: "university",
      name: "متطلبات الجامعة",
      requiredHours: 8,
      courses: ["100 سلم"],
      fallbackCourses: { "100 سلم": facts("السيرة") },
      scope: { type: "institution", institutionId: "test" },
    });
    assert.throws(() => store.remove("university"), /used by 1 major/u);
    store.save({ ...store.get("university"), name: "متطلبات الجامعة المحدثة" }, "university");
    const composed = composeSharedElectiveGroups(
      normalizePlanInput(planStore.getPlan("science", "math")),
      loadSharedElectiveGroups(store.root),
      createDiagnostics(),
    );
    assert.equal(composed.electiveGroups[0].name, "متطلبات الجامعة المحدثة");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("shared elective sources reject unresolved courses and orphan fallbacks", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "saad-shared-integrity-"));
  try {
    const store = createSharedElectiveGroupStore({ root });
    const base = {
      id: "university",
      name: "متطلبات الجامعة",
      requiredHours: 2,
      courses: ["999 سلم"],
      scope: { type: "institution", institutionId: "test" },
    };
    assert.throws(
      () => store.create(base),
      /مقررات غير موجودة في الدليل وتحتاج بيانات بديلة مكتملة: 999 سلم/u,
    );
    assert.throws(
      () => store.create({
        ...base,
        fallbackCourses: {
          "999 سلم": facts("مقرر مكتمل"),
          "998 سلم": facts("بيانات يتيمة"),
        },
      }),
      /بيانات بديلة لا يملكها المصدر: 998 سلم/u,
    );
    const saved = store.create({
      ...base,
      fallbackCourses: { "999 سلم": facts("مقرر مكتمل") },
    });
    assert.equal(saved.fallbackCourses["999 سلم"].name, "مقرر مكتمل");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("activity normalization is applied to direct and aggregated catalog facts", () => {
  const direct = buildCourseCatalog([
    { code: "101 عال", name: "برمجة", academicHours: 3, lectureHours: 3 },
  ]).values().next().value;
  assert.deepEqual([direct.lectureHours, direct.exerciseHours, direct.practicalHours], [3, 0, 0]);

  const aggregated = buildCourseCatalog([
    { code: "102 عال", name: "مختبر", activity: "عملي", creditHours: "1", schedule: [{ startTime: "08:00", endTime: "09:40" }] },
  ]).values().next().value;
  assert.deepEqual([aggregated.lectureHours, aggregated.exerciseHours, aggregated.practicalHours], [0, 0, 2]);
});
