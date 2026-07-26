import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createPlanStore } from "../src/store.mjs";

function temporaryStore() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "saad-plan-store-"));
  return { root, store: createPlanStore(root) };
}

test("college and major CRUD persists valid plans atomically", () => {
  const { root, store } = temporaryStore();
  try {
    store.createCollege({ id: "computer-science", name: "كلية علوم الحاسب" });
    const plan = store.createMajor("computer-science", {
      id: "information-systems",
      major: "نظم المعلومات",
      expectedCredits: 120,
    });
    assert.equal(plan.semesters.length, 1);
    assert.equal(store.listColleges()[0].majors[0].id, "information-systems");

    plan.semesters[0].number = 99;
    plan.semesters[0].name = "اسم يدوي";
    plan.edition = "الطبعة الرابعة";
    plan.release = "إصدار 472.1";
    plan.version = "472.1";
    plan.fallbackCourses = {
      "100 سلم": {
        name: "دراسات في السيرة النبوية",
        academicHours: 2,
        lectureHours: 2,
        exerciseHours: 0,
        practicalHours: 0,
        prerequisites: [],
      },
    };
    plan.semesters[0].courses = ["100 سلم"];
    plan.semesters.push({ number: 2, name: "المستوى 2", yearLabel: "سنة يدوية", courses: [] });
    store.savePlan("computer-science", "information-systems", plan);
    const savedPlan = store.getPlan("computer-science", "information-systems");
    assert.equal(savedPlan.semesters.length, 2);
    assert.deepEqual(savedPlan.semesters.map((semester) => ({
      number: semester.number,
      name: semester.name,
      yearLabel: semester.yearLabel,
    })), [
      { number: undefined, name: undefined, yearLabel: undefined },
      { number: undefined, name: undefined, yearLabel: undefined },
    ]);
    assert.equal(savedPlan.edition, undefined);
    assert.equal(savedPlan.release, undefined);
    assert.equal(savedPlan.version, undefined);
    assert.equal(savedPlan.fallbackCourses, undefined);
    assert.deepEqual(savedPlan.semesters[0].courses[0], {
      code: "100 سلم",
      fallbackName: "دراسات في السيرة النبوية",
      fallbackCreditHours: 2,
      fallbackLectureHours: 2,
      fallbackExerciseHours: 0,
      fallbackPracticalHours: 0,
      prerequisites: [],
      requirement: "required",
      trackSpecific: false,
    });

    store.duplicateMajor("computer-science", "information-systems", {
      id: "information-systems-copy",
      major: "نظم المعلومات - نسخة",
    });
    assert.equal(store.listMajors("computer-science").length, 2);
    assert.throws(
      () => store.duplicateMajor("computer-science", "information-systems", { id: "information-systems-copy" }),
      /already exists/u,
    );

    const temporaryFiles = fs.readdirSync(path.join(root, "computer-science", "information-systems"))
      .filter((name) => name.endsWith(".tmp"));
    assert.deepEqual(temporaryFiles, []);

    store.deleteMajor("computer-science", "information-systems-copy");
    store.deleteCollege("computer-science");
    assert.equal(store.listColleges().length, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("storage rejects unsafe paths and invalid plan schemas", () => {
  const { root, store } = temporaryStore();
  try {
    assert.throws(() => store.createCollege({ id: "../escape", name: "خطر" }), /collegeId/u);
    store.createCollege({ id: "science", name: "كلية العلوم" });
    store.createMajor("science", { id: "physics", major: "الفيزياء" });
    assert.throws(
      () => store.savePlan("science", "physics", { schemaVersion: 1, id: "physics", major: "", semesters: [] }),
      /Invalid plan/u,
    );
    assert.equal(fs.existsSync(path.resolve(root, "..", "escape")), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("saving a proposal writes only the canonical plan", () => {
  const { root, store } = temporaryStore();
  try {
    store.createCollege({ id: "science", name: "كلية العلوم" });
    const plan = store.createMajor("science", { id: "math", major: "الرياضيات" });
    plan.proposal = { semesters: [{ id: "one", placeholders: [] }] };
    store.savePlan("science", "math", plan);
    const files = fs.readdirSync(path.dirname(store.planPath("science", "math")));
    assert.deepEqual(files, ["plan.json"]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
