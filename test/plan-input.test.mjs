import test from "node:test";
import assert from "node:assert/strict";
import { migratePlanForEditor, normalizePlanInput } from "../src/plan-input.mjs";

test("accepts the existing Saad website PlanDefinition shape", () => {
  const plan = normalizePlanInput({
    id: "eng-test",
    college: "ENG",
    name: "هندسة تجريبية",
    degree: "bachelor",
    courseColors: { كهر: "#123456" },
    semesters: [{
      level: 1,
      yearLabel: "السنة الأولى",
      catalogCollege: "ENG",
      courses: [{
        code: "101 كهر",
        fallbackName: "مقدمة",
        fallbackCreditHours: 3,
        prerequisites: [],
        corequisites: [],
        requirement: "required",
        trackSpecific: false,
      }],
    }],
  });
  assert.equal(plan.major, "هندسة تجريبية");
  assert.equal(plan.fallbackCourses["101 كهر"].academicHours, 3);
  assert.equal(plan.semesters[0].courses[0].code, "101 كهر");
});

test("reads registry elective categories and subtracts courses already placed in semesters", () => {
  const plan = normalizePlanInput({
    plans: [{
      id: "cis-test",
      college: "CIS",
      name: "خطة اختبار",
      degree: "bachelor",
      electiveCategoryIds: ["university"],
      semesters: [{
        level: 1,
        yearLabel: "السنة الأولى",
        catalogCollege: "CIS",
        courses: [{
          code: "101 سلم",
          fallbackName: "أصول الثقافة الإسلامية",
          fallbackCreditHours: 2,
          prerequisites: [],
          corequisites: [],
        }],
      }],
    }],
    electiveCategories: [{
      id: "university",
      name: "متطلبات الجامعة",
      requiredCreditHours: 4,
      courses: [
        { code: "101 سلم", fallbackName: "أصول الثقافة الإسلامية", fallbackCreditHours: 2 },
        { code: "102 سلم", fallbackName: "الأسرة في الإسلام", fallbackCreditHours: 2 },
        { code: "103 سلم", fallbackName: "النظام الاقتصادي الإسلامي", fallbackCreditHours: 2 },
      ],
    }],
  }, { planId: "cis-test" });

  assert.equal(plan.electiveGroups.length, 1);
  assert.equal(plan.electiveGroups[0].requiredHours, 2);
  assert.deepEqual(plan.electiveGroups[0].courses.map((course) => course.code), ["102 سلم", "103 سلم"]);
});

test("migrates only the legacy proposal shape for the editor", () => {
  const raw = {
    schemaVersion: 1,
    major: "قديم",
    edition: "استثناء قديم",
    semesters: [{ courses: ["101 عال"] }],
    proposal: {
      semesters: [{
        name: "الأول",
        courses: [
          "101 عال",
          { kind: "placeholder", code: "مقرر", fallback: { name: "نائب", academicHours: 3, lectureHours: 0, exerciseHours: 0, practicalHours: 0 } },
        ],
      }],
    },
  };
  const migrated = migratePlanForEditor(raw);
  assert.deepEqual(migrated.semesters[0].courses, ["101 عال"]);
  assert.equal(migrated.edition, "استثناء قديم");
  assert.deepEqual(migrated.proposal.semesters[0].courseOrder, ["101 عال"]);
  assert.equal(migrated.proposal.semesters[0].placeholders[0].name, "نائب");
  assert.ok(Array.isArray(raw.proposal.semesters[0].courses));
});
