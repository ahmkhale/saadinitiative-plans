import test from "node:test";
import assert from "node:assert/strict";
import { buildCourseCatalog } from "../src/catalog.mjs";
import { courseCodeKey } from "../src/normalize.mjs";

test("reads detailed courses.json shape", () => {
  const catalog = buildCourseCatalog({ courses: [{
    code: { display: "101 كهر" },
    name: "مقدمة في الهندسة الكهربائية",
    hours: 3,
    details: { lecturesHours: "2", labHours: "2", exercisesHours: "0" },
    prerequisites: ["101 ريض"],
  }] });
  assert.equal(catalog.get(courseCodeKey("101 كهر")).academicHours, 3);
  assert.equal(catalog.get(courseCodeKey("101 كهر")).practicalHours, 2);
});

test("aggregates KV catalog rows", () => {
  const catalog = buildCourseCatalog([
    { code: "111 عال", name: "برمجة", activity: "محاضرة", creditHours: "4", schedule: [{ startTime: "08:00", endTime: "10:30" }] },
    { code: "111 عال", name: "برمجة", activity: "عملي", creditHours: "0", schedule: [{ startTime: "11:00", endTime: "12:40" }] },
  ]);
  const course = catalog.get(courseCodeKey("111 عال"));
  assert.equal(course.academicHours, 4);
  assert.equal(course.lectureHours, 3);
  assert.equal(course.practicalHours, 2);
});

test("keeps section provenance and reports conflicting derived facts", () => {
  const catalog = buildCourseCatalog([
    { code: "101 عال", name: "مبادئ البرمجة", activity: "محاضرة", creditHours: "3", schedule: [{ startTime: "08:00", endTime: "10:30" }] },
    { code: "101 عال", name: "برمجة تمهيدية", activity: "محاضرة", creditHours: "4", schedule: [{ startTime: "08:00", endTime: "09:40" }] },
  ], { catalogSource: "male" });
  const course = catalog.get(courseCodeKey("101 عال"));
  assert.equal(course.catalogSource, "male");
  assert.ok(course.conflicts.some((conflict) => conflict.field === "name"));
  assert.ok(course.conflicts.some((conflict) => conflict.field === "academicHours"));
  assert.ok(course.conflicts.some((conflict) => conflict.field === "lectureHours"));
});

test("maps source activity aliases into the existing three displayed fields", () => {
  const rows = [
    ["محاضرة", "101"],
    ["عيادة", "102"],
    ["ستوديو", "103"],
    ["حقلي", "104"],
    ["تدريب", "105"],
    ["مشروع", "106"],
  ].flatMap(([activity, number]) => [{
    code: `${number} تجر`,
    name: activity,
    activity,
    creditHours: "1",
    schedule: [{ startTime: "08:00", endTime: "09:40" }],
  }]);
  const catalog = buildCourseCatalog(rows);

  assert.equal(catalog.get(courseCodeKey("101 تجر")).lectureHours, 2);
  assert.equal(catalog.get(courseCodeKey("102 تجر")).exerciseHours, 2);
  assert.deepEqual(catalog.get(courseCodeKey("101 تجر")).activityTypes, ["محاضرة"]);
  assert.deepEqual(catalog.get(courseCodeKey("102 تجر")).activityTypes, ["عيادة"]);
  assert.deepEqual(catalog.get(courseCodeKey("103 تجر")).activityTypes, ["ستوديو"]);
  for (const code of ["103 تجر", "104 تجر", "105 تجر", "106 تجر"]) {
    assert.equal(catalog.get(courseCodeKey(code)).practicalHours, 2);
  }
});

test("activity aliases are alternatives rather than additive values", () => {
  const catalog = buildCourseCatalog([
    { code: "201 تجر", name: "تطبيقي", activity: "ستوديو", creditHours: "2", schedule: [{ startTime: "08:00", endTime: "09:40" }] },
    { code: "201 تجر", name: "تطبيقي", activity: "مشروع", creditHours: "2", schedule: [{ startTime: "10:00", endTime: "12:30" }] },
  ]);
  const course = catalog.get(courseCodeKey("201 تجر"));

  assert.equal(course.practicalHours, 2);
  assert.deepEqual(course.activityTypes, ["ستوديو", "مشروع"]);
  assert.deepEqual(course.activityAliasConflicts, [{
    field: "practicalHours",
    aliases: ["ستوديو", "مشروع"],
  }]);
});
