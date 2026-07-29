import test from "node:test";
import assert from "node:assert/strict";
import { preparePlanForEditor, normalizePlanInput, validatePlanShape } from "../src/plan-input.mjs";

test("rejects registry and array compatibility shapes", () => {
  assert.throws(() => normalizePlanInput([{ schemaVersion: 1 }]), /canonical single-plan/u);
  assert.throws(() => normalizePlanInput({ plans: [] }), /canonical single-plan/u);
  assert.throws(() => normalizePlanInput({
    schemaVersion: 1,
    major: "صيغة قديمة",
    semesters: [{ courses: [] }],
    proposal: { semesters: [{ id: "old", courses: ["101 عال"], placeholders: [] }] },
  }), /courseOrder references/u);
});

test("parent plans require content while child track overlays may start empty", () => {
  const emptyParent = normalizePlanInput({
    schemaVersion: 1,
    id: "cs",
    major: "علوم الحاسب",
    semesters: [],
  });
  assert.throws(() => validatePlanShape(emptyParent), /parent plans must contain/u);

  const emptyTrack = normalizePlanInput({
    schemaVersion: 1,
    id: "cs",
    major: "علوم الحاسب",
    track: { id: "ai", name: "مسار الذكاء الاصطناعي" },
    semesters: [],
  });
  assert.doesNotThrow(() => validatePlanShape(emptyTrack));
});

test("prepares canonical proposal arrangement without storing real-course facts", () => {
  const raw = {
    schemaVersion: 1,
    major: "قديم",
    edition: "استثناء قديم",
    semesters: [{ name: "اسم يدوي يجب تجاهله", courses: ["101 عال"] }],
    proposal: {
      semesters: [{
        id: "level-1",
        sourceSemesterId: "published-level-1",
        type: "regular",
        courseOrder: ["major:plan:published-level-1:101-عال"],
        placeholders: [{ id: "p1", name: "نائب", academicHours: 3, lectureHours: 0, exerciseHours: 0, practicalHours: 0 }],
      }],
    },
  };
  const prepared = preparePlanForEditor(raw);
  assert.deepEqual(prepared.semesters[0].courses, [{
    id: "major:undefined:published-level-1:101-عال",
    code: "101 عال",
    prerequisites: [],
    corequisites: [],
    minimumCompletedCredits: null,
    prerequisiteConditions: [],
  }]);
  assert.equal(prepared.edition, undefined);
  assert.equal(prepared.proposal.semesters[0].placeholders[0].name, "نائب");
  assert.deepEqual(prepared.proposal.semesters[0].courseOrder, ["major:plan:published-level-1:101-عال"]);
  assert.equal(prepared.proposal.semesters[0].courses, undefined);
});


test("derives Arabic semester labels and ignores manual names and numbers", () => {
  const plan = normalizePlanInput({
    schemaVersion: 1,
    major: "تسمية",
    semesters: [
      { number: 7, name: "المستوى 2", courses: [] },
      { name: "أي اسم", courses: [] },
    ],
  });
  assert.deepEqual(plan.semesters.map((semester) => semester.name), ["المستوى الأول", "المستوى الثاني"]);
  assert.deepEqual(plan.semesters.map((semester) => semester.number), [1, 2]);
  assert.deepEqual(plan.semesters.map((semester) => semester.id), ["published-level-1", "published-level-2"]);
});
