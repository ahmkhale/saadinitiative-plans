import test from "node:test";
import assert from "node:assert/strict";
import { buildCourseCatalog } from "../src/catalog.mjs";
import { createDiagnostics } from "../src/diagnostics.mjs";
import { normalizePlanInput } from "../src/plan-input.mjs";
import { resolvePlan } from "../src/resolve.mjs";

const colors = { عام: "#616161", كهر: "#17529B", ريض: "#A36127" };

test("catalog wins over fallback, override wins over catalog, and parent course is derived", () => {
  const plan = normalizePlanInput({
    schemaVersion: 1,
    major: "هندسة كهربائية",
    expectedCredits: 7,
    semesters: [
      { courses: ["101 ريض", { code: "201 كهر", override: { name: "دوائر كهربائية أ" } }] },
    ],
    fallbackCourses: {
      "101 ريض": { name: "اسم قديم", academicHours: 3 },
      "201 كهر": { name: "دوائر كهربائية", academicHours: 4, prerequisites: ["101 ريض"] },
    },
  });
  const catalog = buildCourseCatalog({ courses: [
    { code: "101 ريض", name: "حساب التفاضل", hours: 3, details: { lecturesHours: "3" } },
    { code: "201 كهر", name: "تحليل الدوائر", hours: 4, prerequisites: ["101 ريض"] },
  ] });
  const diagnostics = createDiagnostics();
  const resolved = resolvePlan(plan, catalog, colors, diagnostics);
  const [math, circuits] = resolved.semesters[0].courses;
  assert.equal(math.name, "حساب التفاضل");
  assert.equal(circuits.name, "دوائر كهربائية أ");
  assert.equal(math.isParentCourse, true);
  assert.equal(resolved.totalHours, 7);
  assert.equal(diagnostics.summary.errors, 0);
});

test("same-semester prerequisite becomes a corequisite automatically", () => {
  const plan = normalizePlanInput({
    schemaVersion: 1,
    major: "اختبار",
    semesters: [{ courses: ["101 ريض", "102 كهر"] }],
    fallbackCourses: {
      "101 ريض": { name: "رياضيات", academicHours: 3 },
      "102 كهر": { name: "كهرباء", academicHours: 3, prerequisites: ["101 ريض"] },
    },
  });
  const resolved = resolvePlan(plan, new Map(), colors, createDiagnostics());
  const course = resolved.semesters[0].courses[1];
  assert.deepEqual(course.prerequisites, []);
  assert.deepEqual(course.corequisites, ["101 ريض"]);
});

test("catalog rows without prerequisite metadata preserve the plan fallback graph", () => {
  const plan = normalizePlanInput({
    schemaVersion: 1,
    major: "اختبار",
    semesters: [
      { courses: ["101 ريض"] },
      { courses: ["201 كهر"] },
    ],
    fallbackCourses: {
      "101 ريض": { name: "رياضيات", academicHours: 3 },
      "201 كهر": { name: "دوائر", academicHours: 3, prerequisites: ["101 ريض"] },
    },
  });
  const catalog = buildCourseCatalog([
    { code: "201 كهر", name: "دوائر كهربائية", activity: "محاضرة", creditHours: "3", schedule: [] },
  ]);
  const resolved = resolvePlan(plan, catalog, colors, createDiagnostics());
  assert.deepEqual(resolved.semesters[1].courses[0].prerequisites, ["101 ريض"]);
  assert.equal(resolved.semesters[0].courses[0].isParentCourse, true);
});

test("resolves a proposed page with unique black placeholders and a summer total", () => {
  const placeholder = (hours) => ({
    kind: "placeholder",
    code: "مقرر",
    fallback: {
      name: "من متطلبات المسار",
      academicHours: hours,
      lectureHours: 0,
      practicalHours: 0,
      exerciseHours: 0,
      color: "#000000",
    },
  });
  const plan = normalizePlanInput({
    schemaVersion: 1,
    major: "اختبار",
    semesters: [{ courses: ["101 ريض"] }],
    fallbackCourses: {
      "101 ريض": { name: "رياضيات", academicHours: 3 },
    },
    proposal: {
      title: "الخطة المقترحة",
      expectedCredits: 10,
      semesters: [
        { name: "المستوى الأول", courses: ["101 ريض", placeholder(3), placeholder(3)] },
        { name: "صيفي", courses: [{ ...placeholder(1), fallback: { ...placeholder(1).fallback, name: "تدريب" } }] },
      ],
    },
  });
  const diagnostics = createDiagnostics();
  const resolved = resolvePlan(plan, new Map(), colors, diagnostics);
  assert.equal(resolved.proposal.totalHours, 10);
  assert.equal(resolved.proposal.semesters[1].cumulativeHours, 10);
  assert.equal(resolved.proposal.semesters[0].courses.filter((course) => course.isPlaceholder).length, 2);
  assert.equal(diagnostics.summary.errors, 0);
});

test("reports fixed-card overflow instead of silently shrinking the Figma layout", () => {
  const longName = "اسم مقرر طويل جدا يتجاوز المساحة المقاسة داخل بطاقة فيقما الثابتة";
  const courses = Array.from({ length: 7 }, (_, index) => `${index + 101} ريض`);
  const fallbackCourses = Object.fromEntries(courses.map((code, index) => [
    code,
    {
      name: index === 0 ? longName : `مقرر ${index + 1}`,
      academicHours: 3,
    },
  ]));
  const plan = normalizePlanInput({
    schemaVersion: 1,
    major: "اختبار تجاوز التخطيط",
    semesters: [{ name: "المستوى الأول", courses }],
    fallbackCourses,
  });
  const diagnostics = createDiagnostics();

  resolvePlan(plan, new Map(), colors, diagnostics);

  assert.equal(diagnostics.summary.errors, 1);
  assert.ok(diagnostics.items.some((item) => item.code === "SEMESTER_CARD_OVERFLOW"));
  assert.ok(diagnostics.items.some((item) => item.code === "COURSE_NAME_OVERFLOW"));
});
