import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { resolveDraft } from "../src/preview.mjs";

const fixturePath = new URL(
  "../institutions/ksu/colleges/engineering/majors/electrical-engineering/plan.json",
  import.meta.url,
);

function byCode(entries) {
  return new Map(entries.map((entry) => [entry.code, entry]));
}

test("Electrical Engineering stores the actual Figma requirement semantics", () => {
  const plan = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  const courses = byCode(plan.semesters.flatMap((semester) => semester.courses));

  assert.deepEqual(courses.get("201 كهر").prerequisites, ["106 ريض"]);
  assert.deepEqual(courses.get("203 كهر").prerequisites, ["104 فيز", "203 ريض"]);
  assert.deepEqual(courses.get("210 كهر").corequisites, ["208 كهر"]);
  assert.deepEqual(courses.get("312 كهر").corequisites, ["310 كهر"]);
  assert.deepEqual(courses.get("496 كهر"), {
    ...courses.get("496 كهر"),
    prerequisites: [],
    corequisites: [],
    minimumCompletedCredits: 129,
    prerequisiteConditions: ["مستوى 7"],
  });
  assert.equal(courses.get("999 كهر").minimumCompletedCredits, 110);
  assert.deepEqual(courses.get("497 كهر").prerequisites, ["496 كهر"]);

  for (const facts of Object.values(plan.fallbackCourses)) {
    assert.equal(facts.prerequisites, undefined);
    assert.equal(facts.corequisites, undefined);
    assert.equal(facts.minimumCompletedCredits, undefined);
    assert.equal(facts.prerequisiteConditions, undefined);
  }
});

test("Electrical parent markers come only from later published prerequisites", () => {
  const plan = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  const result = resolveDraft(plan);
  assert.equal(result.ok, true);

  const published = byCode(result.plan.semesters.flatMap((semester) => semester.courses));
  assert.equal(published.get("201 كهر").requirementLabel, "106 ريض");
  assert.equal(published.get("210 كهر").requirementLabel, "208 كهر مرافق");
  assert.equal(published.get("201 كهر").isParentCourse, true);
  assert.equal(published.get("301 كهر").isParentCourse, true);
  assert.equal(published.get("210 كهر").isParentCourse, false);
  assert.equal(published.get("496 كهر").isParentCourse, true);
  assert.equal(published.get("497 كهر").isParentCourse, false);

  const electiveCourses = result.plan.electiveGroups.flatMap((group) => group.courses);
  assert.ok(electiveCourses.some((course) => course.prerequisites.length > 0));
  assert.ok(electiveCourses.every((course) => course.isParentCourse === false));
});
