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
    assert.deepEqual(savedPlan.fallbackCourses["100 سلم"], {
      name: "دراسات في السيرة النبوية",
      academicHours: 2,
      lectureHours: 2,
      exerciseHours: 0,
      practicalHours: 0,
      source: "manual",
      manuallyEditedFields: ["name", "academicHours", "lectureHours", "exerciseHours", "practicalHours"],
    });
    assert.deepEqual(savedPlan.semesters[0].courses[0], {
      id: "major:information-systems:published-level-1:100-سلم",
      code: "100 سلم",
      prerequisites: [],
      corequisites: [],
      minimumCompletedCredits: null,
      prerequisiteConditions: [],
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

    const temporaryFiles = fs.readdirSync(path.join(root, "computer-science", "majors", "information-systems"))
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

test("majors own nested tracks and derive track-specific courses from sibling membership", () => {
  const { root, store } = temporaryStore();
  try {
    store.createCollege({ id: "ccis", name: "كلية علوم الحاسب والمعلومات" });
    const general = store.createMajor("ccis", { id: "cs", major: "علوم الحاسب" });
    general.semesters[0].courses = ["101 عال", "201 عال"];
    store.savePlan("ccis", "cs", general);

    store.createTrack("ccis", "cs", {
      id: "ai",
      name: "مسار الذكاء الاصطناعي",
      rootTrackId: "general",
      rootTrackName: "المسار العام",
      sourceTrackId: "cs",
    });
    const ai = store.getPlan("ccis", "cs", "ai");
    ai.semesters[0].courses = ai.semesters[0].courses.filter((course) => course.code !== "201 عال");
    ai.semesters[0].courses.push("301 عال");
    store.savePlan("ccis", "cs", ai, "ai");

    const summary = store.listMajors("ccis")[0];
    assert.deepEqual(summary.tracks.map((track) => track.name), [
      "المسار العام",
      "مسار الذكاء الاصطناعي",
    ]);
    const derivedGeneral = store.getPlanForEditor("ccis", "cs", "general");
    const derivedAi = store.getPlanForEditor("ccis", "cs", "ai");
    assert.equal(derivedGeneral.semesters[0].courses.find((course) => course.code === "101 عال").trackSpecific, undefined);
    assert.equal(derivedGeneral.semesters[0].courses.find((course) => course.code === "201 عال").trackSpecific, true);
    assert.equal(derivedAi.semesters[0].courses.find((course) => course.code === "301 عال").trackSpecific, true);
    assert.equal(store.getPlan("ccis", "cs", "ai").semesters[0].courses.some((course) => course.trackSpecific), false);

    store.duplicateMajor("ccis", "cs", { id: "cs-copy", major: "علوم الحاسب - نسخة" });
    assert.deepEqual(store.listTracks("ccis", "cs-copy").map((track) => track.id), ["general", "ai"]);
    assert.equal(store.getPlan("ccis", "cs-copy", "ai").major, "علوم الحاسب - نسخة");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});


test("plan schema forbids derived semester presentation fields", () => {
  const schema = JSON.parse(fs.readFileSync(new URL("../schemas/plan.schema.json", import.meta.url), "utf8"));
  const semester = schema.$defs.semester;
  assert.equal(semester.additionalProperties, false);
  for (const field of ["number", "level", "name", "yearLabel"]) {
    assert.equal(Object.hasOwn(semester.properties, field), false, `${field} must remain derived`);
  }
});
