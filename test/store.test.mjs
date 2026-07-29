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

test("tracks inherit one editable parent plan and store only child additions", () => {
  const { root, store } = temporaryStore();
  try {
    store.createCollege({ id: "ccis", name: "كلية علوم الحاسب والمعلومات" });
    const parent = store.createMajor("ccis", { id: "cs", major: "علوم الحاسب" });
    parent.semesters[0].courses = ["101 عال", "201 عال"];
    store.savePlan("ccis", "cs", parent);

    store.createTrack("ccis", "cs", {
      id: "general",
      name: "المسار العام",
    });
    store.createTrack("ccis", "cs", {
      id: "ai",
      name: "مسار الذكاء الاصطناعي",
    });
    store.createTrack("ccis", "cs", {
      id: "networks",
      name: "مسار الشبكات",
    });
    const general = store.getPlan("ccis", "cs", "general");
    general.semesters.push({ id: "general-level-1", courses: ["302 عال"] });
    general.fallbackCourses["302 عال"] = {
      name: "مقرر مشترك بين المسارات",
      academicHours: 3,
      lectureHours: 2,
      exerciseHours: 1,
      practicalHours: 0,
      source: "manual",
      manuallyEditedFields: ["name", "academicHours", "lectureHours", "exerciseHours", "practicalHours"],
    };
    store.savePlan("ccis", "cs", general, "general");
    const ai = store.getPlan("ccis", "cs", "ai");
    ai.semesters.push({ id: "ai-level-1", courses: ["301 عال", "302 عال"] });
    store.savePlan("ccis", "cs", ai, "ai");

    const summary = store.listMajors("ccis")[0];
    assert.deepEqual(new Set(summary.tracks.map((track) => track.name)), new Set([
      "المسار العام",
      "مسار الذكاء الاصطناعي",
      "مسار الشبكات",
    ]));
    const derivedGeneral = store.getComposedPlan("ccis", "cs", "general");
    const derivedAi = store.getComposedPlan("ccis", "cs", "ai");
    assert.equal(derivedGeneral.semesters[0].courses.find((course) => course.code === "101 عال").trackSpecific, undefined);
    assert.equal(derivedGeneral.semesters[0].courses.find((course) => course.code === "201 عال").trackSpecific, undefined);
    assert.equal(derivedGeneral.semesters[1].courses.find((course) => course.code === "302 عال").trackSpecific, undefined);
    assert.equal(derivedAi.semesters[1].courses.find((course) => course.code === "302 عال").trackSpecific, undefined);
    assert.equal(derivedAi.fallbackCourses["302 عال"].name, "مقرر مشترك بين المسارات");
    assert.equal(store.getPlan("ccis", "cs", "ai").fallbackCourses["302 عال"], undefined);
    assert.equal(derivedAi.semesters[1].courses.find((course) => course.code === "301 عال").trackSpecific, true);
    assert.equal(store.getPlan("ccis", "cs", "ai").semesters[0].courses[0].code, "301 عال");
    assert.equal(store.getPlan("ccis", "cs", "ai").fallbackCourses["101 عال"], undefined);

    const parentDraft = store.getPlan("ccis", "cs");
    parentDraft.semesters[0].courses.push("203 عال");
    assert.ok(store.getComposedPlan("ccis", "cs", null, parentDraft)
      .semesters[0].courses.some((course) => course.code === "203 عال"));
    assert.equal(store.getPlan("ccis", "cs").semesters[0].courses.some((course) => course.code === "203 عال"), false);

    const editedParent = store.getPlan("ccis", "cs");
    editedParent.semesters[0].courses.push("202 عال");
    store.savePlan("ccis", "cs", editedParent);
    assert.ok(store.getComposedPlan("ccis", "cs", "general").semesters[0].courses.some((course) => course.code === "202 عال"));
    assert.ok(store.getComposedPlan("ccis", "cs", "ai").semesters[0].courses.some((course) => course.code === "202 عال"));

    store.duplicateMajor("ccis", "cs", { id: "cs-copy", major: "علوم الحاسب - نسخة" });
    assert.deepEqual(
      new Set(store.listTracks("ccis", "cs-copy").map((track) => track.id)),
      new Set(["general", "ai", "networks"]),
    );
    assert.equal(store.getPlan("ccis", "cs-copy", "ai").major, "علوم الحاسب - نسخة");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("manual course facts are reused across majors without sharing plan requirements", () => {
  const { root, store } = temporaryStore();
  try {
    store.createCollege({ id: "ccis", name: "كلية علوم الحاسب والمعلومات" });
    const computerScience = store.createMajor("ccis", { id: "cs", major: "علوم الحاسب" });
    computerScience.semesters[0].courses = ["216 عال"];
    computerScience.fallbackCourses["216 عال"] = {
      name: "البرمجة بلغة Python",
      academicHours: 3,
      lectureHours: 2,
      exerciseHours: 0,
      practicalHours: 2,
      source: "manual",
      manuallyEditedFields: ["name", "academicHours", "lectureHours", "exerciseHours", "practicalHours"],
    };
    store.savePlan("ccis", "cs", computerScience);

    const informationSystems = store.createMajor("ccis", { id: "is", major: "نظم المعلومات" });
    informationSystems.semesters[0].courses = [{
      code: "216 عال",
      prerequisites: ["101 عال"],
    }];
    store.savePlan("ccis", "is", informationSystems);
    store.createTrack("ccis", "is", { id: "data", name: "مسار البيانات" });

    const track = store.getPlan("ccis", "is", "data");
    track.semesters.push({
      id: "data-level-1",
      courses: [{ code: "216 عال", corequisites: ["201 عال"] }],
    });
    const composed = store.getComposedPlan("ccis", "is", "data", track);
    const composedParent = store.getComposedPlan("ccis", "is");

    assert.equal(composed.fallbackCourses["216 عال"].name, "البرمجة بلغة Python");
    assert.equal(composedParent.fallbackCourses["216 عال"].name, "البرمجة بلغة Python");
    assert.deepEqual(composed.semesters[0].courses[0].prerequisites, ["101 عال"]);
    assert.deepEqual(composed.semesters[1].courses[0].corequisites, ["201 عال"]);
    assert.equal(store.getPlan("ccis", "is").fallbackCourses["216 عال"], undefined);
    assert.equal(store.getPlan("ccis", "is", "data").fallbackCourses["216 عال"], undefined);
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
