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

    plan.semesters.push({ number: 2, name: "المستوى الثاني", courses: [] });
    store.savePlan("computer-science", "information-systems", plan);
    assert.equal(store.getPlan("computer-science", "information-systems").semesters.length, 2);

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
