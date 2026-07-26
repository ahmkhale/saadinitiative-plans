import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createDiagnostics } from "../src/diagnostics.mjs";
import { normalizePlanInput } from "../src/plan-input.mjs";
import { composeSharedSemesterSets, createSharedSemesterSetStore } from "../src/shared-semester-sets.mjs";
import { createPlanStore } from "../src/store.mjs";

test("shared semester sets compose without copying and cannot be deleted while referenced", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "saad-shared-sets-"));
  try {
    const planStore = createPlanStore(path.join(root, "colleges"));
    const setStore = createSharedSemesterSetStore({ root: path.join(root, "sets"), planStore });
    planStore.createCollege({ id: "science", name: "كلية العلوم" });
    const plan = planStore.createMajor("science", { id: "physics", major: "الفيزياء" });
    setStore.create({
      id: "preparatory-scientific",
      name: "التحضيري العلمي",
      phaseLabel: "السنة التحضيرية",
      semesters: [
        { name: "التحضيري الأول", courses: ["101 ريض"] },
        { name: "التحضيري الثاني", courses: ["102 ريض"] },
      ],
      fallbackCourses: {},
    });
    plan.sharedSemesterSets = ["preparatory-scientific"];
    planStore.savePlan("science", "physics", plan);

    const persisted = planStore.getPlan("science", "physics");
    assert.equal(persisted.semesters.length, 1);
    const composed = composeSharedSemesterSets(
      normalizePlanInput(persisted),
      setStore.load(),
      createDiagnostics(),
    );
    assert.equal(composed.semesters.length, 3);
    assert.equal(composed.semesters[0].inheritedFrom, "preparatory-scientific");
    assert.equal(setStore.list()[0].usages[0].majorId, "physics");
    assert.throws(() => setStore.remove("preparatory-scientific"), /used by 1 major/u);

    const edited = setStore.get("preparatory-scientific");
    edited.semesters[0].courses.push({ code: "103 فيز" });
    setStore.save(edited, edited.id);
    const propagated = composeSharedSemesterSets(normalizePlanInput(persisted), setStore.load(), createDiagnostics());
    assert.equal(propagated.semesters[0].courses.length, 2);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

