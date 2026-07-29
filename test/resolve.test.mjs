import test from "node:test";
import assert from "node:assert/strict";
import { buildCourseCatalog } from "../src/catalog.mjs";
import { createDiagnostics } from "../src/diagnostics.mjs";
import { normalizePlanInput } from "../src/plan-input.mjs";
import { resolvePlan } from "../src/resolve.mjs";

const colors = { عام: "#616161", كهر: "#17529B", ريض: "#A36127" };

test("catalog facts resolve independently while same-semester rules do not create a parent marker", () => {
  const plan = normalizePlanInput({
    schemaVersion: 1,
    major: "هندسة كهربائية",
    expectedCredits: 7,
    semesters: [
      { courses: ["101 ريض", { code: "201 كهر", prerequisites: ["101 ريض"], override: { name: "دوائر كهربائية أ" } }] },
    ],
    fallbackCourses: {
      "101 ريض": { name: "اسم قديم", academicHours: 3, source: "catalog" },
      "201 كهر": { name: "دوائر كهربائية", academicHours: 4, source: "catalog" },
    },
  });
  const catalog = buildCourseCatalog({ courses: [
    { code: "101 ريض", name: "حساب التفاضل", hours: 3, details: { lecturesHours: "3" } },
    { code: "201 كهر", name: "تحليل الدوائر", hours: 4, lectureHours: 4, prerequisites: ["101 ريض"] },
  ] });
  const diagnostics = createDiagnostics();
  const resolved = resolvePlan(plan, catalog, colors, diagnostics);
  const [math, circuits] = resolved.semesters[0].courses;
  assert.equal(math.name, "حساب التفاضل");
  assert.equal(circuits.name, "دوائر كهربائية أ");
  assert.equal(math.isParentCourse, false);
  assert.equal(resolved.totalHours, 7);
  assert.equal(diagnostics.summary.errors, 0);
});

test("resolved courses retain historical catalog term provenance", () => {
  const plan = normalizePlanInput({
    schemaVersion: 1,
    major: "تاريخي",
    semesters: [{ courses: ["101 عال"] }],
  });
  const catalog = buildCourseCatalog([
    { code: "101 عال", name: "برمجة", academicHours: 3, lectureHours: 3, exerciseHours: 0, practicalHours: 0 },
  ], { catalogSource: "male" });
  const historical = new Map([...catalog].map(([key, course]) => [
    key,
    { ...course, catalogTermId: "471", catalogIsHistorical: true },
  ]));

  const resolved = resolvePlan(plan, historical, colors, createDiagnostics());
  const course = resolved.semesters[0].courses[0];

  assert.equal(course.catalogTermId, "471");
  assert.equal(course.sourceBadge, "دليل الطلاب · 471");
});

test("warns when a course supplies multiple aliases for one displayed activity field", () => {
  const plan = normalizePlanInput({
    schemaVersion: 1,
    major: "اختبار",
    semesters: [{ courses: ["201 تجر"] }],
  });
  const catalog = buildCourseCatalog([
    { code: "201 تجر", name: "تطبيقي", activity: "عملي", creditHours: "2", schedule: [{ startTime: "08:00", endTime: "09:40" }] },
    { code: "201 تجر", name: "تطبيقي", activity: "مشروع", creditHours: "2", schedule: [{ startTime: "10:00", endTime: "12:30" }] },
  ]);
  const diagnostics = createDiagnostics();

  resolvePlan(plan, catalog, colors, diagnostics);

  const warning = diagnostics.items.find((item) => item.code === "MULTIPLE_ACTIVITY_ALIASES");
  assert.equal(warning?.severity, "warnings");
  assert.deepEqual(warning?.conflicts, [{
    field: "practicalHours",
    aliases: ["عملي", "مشروع"],
  }]);
});

test("zero expected plan hours disables the plan-hours mismatch check", () => {
  const plan = normalizePlanInput({
    schemaVersion: 1,
    major: "اختبار",
    expectedCredits: 0,
    semesters: [{ courses: ["101 ريض"] }],
    fallbackCourses: {
      "101 ريض": {
        name: "رياضيات",
        academicHours: 3,
        lectureHours: 3,
        exerciseHours: 0,
        practicalHours: 0,
      },
    },
  });
  const diagnostics = createDiagnostics();

  const resolved = resolvePlan(plan, new Map(), colors, diagnostics);

  assert.equal(resolved.expectedCredits, 0);
  assert.equal(resolved.totalHours, 3);
  assert.equal(diagnostics.items.some((item) => item.code === "PLAN_HOURS_MISMATCH"), false);
});

test("plan hours include published semesters and numeric elective requirements", () => {
  const plan = normalizePlanInput({
    schemaVersion: 1,
    major: "اختبار",
    expectedCredits: 24,
    semesters: [{ courses: ["101 ريض"] }],
    electiveGroups: [
      { id: "major", name: "اختياري التخصص", requiredHours: 12, courses: ["201 ريض"] },
      { id: "college", name: "اختياري الكلية", requiredHours: 6, courses: ["202 ريض"] },
      { id: "university", name: "اختياري الجامعة", requiredHours: 3, courses: ["203 ريض"] },
    ],
    fallbackCourses: Object.fromEntries(["101 ريض", "201 ريض", "202 ريض", "203 ريض"].map((code) => [code, {
      name: code,
      academicHours: 3,
      lectureHours: 3,
      exerciseHours: 0,
      practicalHours: 0,
    }])),
  });
  const diagnostics = createDiagnostics();

  const resolved = resolvePlan(plan, new Map(), colors, diagnostics);

  assert.equal(resolved.publishedHours, 3);
  assert.equal(resolved.electiveHours, 21);
  assert.equal(resolved.totalHours, 24);
  assert.equal(diagnostics.items.some((item) => item.code === "PLAN_HOURS_MISMATCH"), false);
});

test("explicitly edited fallback fields override only their matching catalog facts", () => {
  const plan = normalizePlanInput({
    schemaVersion: 1,
    major: "اختبار",
    semesters: [{ courses: ["413 هال"] }],
    fallbackCourses: {
      "413 هال": {
        name: "اسم يدوي قديم",
        academicHours: 3,
        lectureHours: 3,
        source: "manual",
        manuallyEditedFields: ["lectureHours"],
      },
    },
  });
  const catalog = buildCourseCatalog([{
    code: "413 هال",
    name: "عمارة الحاسبات (2)",
    academicHours: 3,
    lectureHours: 1,
    exerciseHours: 1,
    practicalHours: 0,
  }]);

  const resolved = resolvePlan(plan, catalog, colors, createDiagnostics());
  const course = resolved.semesters[0].courses[0];

  assert.equal(course.name, "عمارة الحاسبات (2)");
  assert.equal(course.lectureHours, 3);
  assert.equal(course.exerciseHours, 1);
  assert.equal(course.source, "catalog");
});

test("same-semester prerequisite becomes a corequisite automatically", () => {
  const plan = normalizePlanInput({
    schemaVersion: 1,
    major: "اختبار",
    semesters: [{ courses: ["101 ريض", { code: "102 كهر", prerequisites: ["101 ريض"] }] }],
    fallbackCourses: {
      "101 ريض": { name: "رياضيات", academicHours: 3, lectureHours: 0, exerciseHours: 0, practicalHours: 0 },
      "102 كهر": { name: "كهرباء", academicHours: 3, prerequisites: ["101 ريض"] },
    },
  });
  const resolved = resolvePlan(plan, new Map(), colors, createDiagnostics());
  const course = resolved.semesters[0].courses[1];
  assert.deepEqual(course.prerequisites, []);
  assert.deepEqual(course.corequisites, ["101 ريض"]);
});

test("code-only catalog facts and dependency markers update after course deletion", () => {
  const catalog = buildCourseCatalog([
    { code: "101 ريض", name: "رياضيات", academicHours: 3 },
    { code: "102 كهر", name: "مختبر", academicHours: 1 },
    {
      code: "201 كهر",
      name: "دوائر",
      academicHours: 4,
      prerequisites: ["101 ريض"],
      corequisites: ["102 كهر"],
      minimumCompletedCredits: 30,
    },
  ]);
  const input = {
    schemaVersion: 1,
    major: "اختبار الاشتقاق",
    semesters: [
      { courses: ["101 ريض", "102 كهر"] },
      { courses: [{ code: "201 كهر", prerequisites: ["101 ريض"], corequisites: ["102 كهر"], minimumCompletedCredits: 30 }] },
    ],
  };
  const resolved = resolvePlan(normalizePlanInput(input), catalog, colors, createDiagnostics());
  const dependent = resolved.semesters[1].courses[0];
  assert.equal(dependent.name, "دوائر");
  assert.deepEqual(dependent.prerequisites, ["101 ريض"]);
  assert.deepEqual(dependent.corequisites, ["102 كهر"]);
  assert.equal(dependent.minimumCompletedCredits, 30);
  assert.equal(resolved.semesters[0].courses[0].isParentCourse, true);
  assert.equal(resolved.totalHours, 8);

  const reduced = structuredClone(input);
  reduced.semesters[1].courses = [];
  const afterDeletion = resolvePlan(normalizePlanInput(reduced), catalog, colors, createDiagnostics());
  assert.equal(afterDeletion.semesters[0].courses[0].isParentCourse, false);
  assert.equal(afterDeletion.totalHours, 4);
});

test("course requirements come from plan rules rather than catalog or fallback facts", () => {
  const plan = normalizePlanInput({
    schemaVersion: 1,
    major: "اختبار",
    semesters: [
      { courses: ["101 ريض"] },
      { courses: [{ code: "201 كهر", prerequisites: ["101 ريض"] }] },
    ],
    fallbackCourses: {
      "101 ريض": { name: "رياضيات", academicHours: 3, lectureHours: 0, exerciseHours: 0, practicalHours: 0 },
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

test("elective dependencies and corequisites never create published parent markers", () => {
  const facts = (name) => ({
    name,
    academicHours: 3,
    lectureHours: 3,
    exerciseHours: 0,
    practicalHours: 0,
  });
  const plan = normalizePlanInput({
    schemaVersion: 1,
    major: "اختبار العلامات",
    semesters: [
      { courses: ["101 عال", "102 عال"] },
      { courses: [{ code: "201 عال", corequisites: ["101 عال"] }] },
    ],
    electiveGroups: [{
      id: "electives",
      name: "اختياري",
      requiredHours: 3,
      courses: [{ code: "301 عال", prerequisites: ["102 عال"] }],
    }],
    fallbackCourses: Object.fromEntries(
      ["101 عال", "102 عال", "201 عال", "301 عال"].map((code) => [code, facts(code)]),
    ),
  });
  const resolved = resolvePlan(plan, new Map(), colors, createDiagnostics());
  assert.equal(resolved.semesters[0].courses[0].isParentCourse, false);
  assert.equal(resolved.semesters[0].courses[1].isParentCourse, false);
  assert.equal(resolved.electiveGroups[0].courses[0].isParentCourse, false);
  assert.deepEqual(resolved.electiveGroups[0].courses[0].prerequisites, ["102 عال"]);
});

test("proposal inherits published facts and appends black placeholders", () => {
  const plan = normalizePlanInput({
    schemaVersion: 1,
    major: "اختبار",
    semesters: [
      { id: "published-1", courses: ["102 ريض", "101 ريض"] },
      { id: "published-2", courses: ["201 ريض"] },
    ],
    fallbackCourses: Object.fromEntries(["101 ريض", "102 ريض", "201 ريض"].map((code) => [code, {
      name: code,
      academicHours: 3,
      lectureHours: 3,
      exerciseHours: 0,
      practicalHours: 0,
    }])),
    proposal: {
      title: "الخطة المقترحة",
      semesters: [
        { id: "published-1", sourceSemesterId: "published-1", type: "regular", courseOrder: ["major:plan:published-1:101-ريض", "major:plan:published-1:102-ريض"], placeholders: [{ id: "p1", name: "من متطلبات المسار", allocationHours: 3, hoursDisplay: "unknown" }] },
        { id: "published-2", sourceSemesterId: "published-2", type: "regular", courseOrder: ["major:plan:published-2:201-ريض"], placeholders: [] },
      ],
    },
  });
  const diagnostics = createDiagnostics();
  const resolved = resolvePlan(plan, new Map(), colors, diagnostics);
  assert.equal(resolved.proposal.totalHours, 12);
  assert.deepEqual(
    resolved.proposal.semesters[0].courses.filter((course) => !course.isPlaceholder).map((course) => course.code),
    ["101 ريض", "102 ريض"],
  );
  const placeholder = resolved.proposal.semesters[0].courses.at(-1);
  assert.equal(placeholder.isPlaceholder, true);
  assert.equal(placeholder.code, "مقرر");
  assert.equal(placeholder.academicHours, 3);
  assert.deepEqual(
    [placeholder.lectureHours, placeholder.exerciseHours, placeholder.practicalHours],
    [null, null, null],
  );
  assert.equal(placeholder.color, "#000000");
  assert.equal(diagnostics.summary.errors, 0);
});

test("accepts seven-course semesters without an overflow error", () => {
  const longName = "اسم مقرر طويل جدا يتجاوز المساحة المقاسة داخل بطاقة فيقما الثابتة";
  const courses = Array.from({ length: 7 }, (_, index) => `${index + 101} ريض`);
  const fallbackCourses = Object.fromEntries(courses.map((code, index) => [
    code,
    {
      name: index === 0 ? longName : `مقرر ${index + 1}`,
      academicHours: 3,
      lectureHours: 0,
      exerciseHours: 0,
      practicalHours: 0,
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

  assert.equal(diagnostics.summary.errors, 0);
});

test("plan-owned rules augment catalog facts and keep manual zero hours", () => {
  const plan = normalizePlanInput({
    schemaVersion: 1,
    major: "قواعد الخطة",
    semesters: [{
      courses: [
        "101 عال",
        {
          code: "201 عال",
          prerequisites: ["101 عال"],
          corequisites: ["202 عال"],
          minimumCompletedCredits: 60,
          trackSpecific: true,
        },
        "202 عال",
        "999 جدد",
      ],
    }],
    fallbackCourses: {
      "999 جدد": {
        name: "مقرر جديد",
        academicHours: 3,
        lectureHours: 2,
        exerciseHours: 0,
        practicalHours: 2,
      },
    },
  });
  const catalog = buildCourseCatalog([
    { code: "101 عال", name: "مبادئ", academicHours: 3, lectureHours: 3, exerciseHours: 0, practicalHours: 0 },
    { code: "201 عال", name: "متقدم", academicHours: 3, lectureHours: 3, exerciseHours: 0, practicalHours: 0 },
    { code: "202 عال", name: "مختبر", academicHours: 1, lectureHours: 0, exerciseHours: 0, practicalHours: 2 },
  ], { catalogSource: "male" });
  const diagnostics = createDiagnostics();
  const resolved = resolvePlan(plan, catalog, colors, diagnostics);
  const advanced = resolved.semesters[0].courses.find((course) => course.code === "201 عال");
  const manual = resolved.semesters[0].courses.find((course) => course.code === "999 جدد");
  assert.deepEqual(advanced.corequisites.sort(), ["101 عال", "202 عال"]);
  assert.equal(advanced.minimumCompletedCredits, 60);
  assert.equal(advanced.isTrackSpecific, true);
  assert.equal(advanced.catalogSource, "male");
  assert.equal(manual.catalogSource, "manual");
  assert.equal(manual.exerciseHours, 0);
  assert.equal(manual.sourceBadge, "مدخل يدويًا");
  assert.equal(diagnostics.summary.errors, 0);
});

test("proposal can move and reorder real courses while preserving the exact parent set", () => {
  const base = normalizePlanInput({
    schemaVersion: 1,
    major: "مقترح",
    semesters: [
      { id: "published-1", courses: ["102 عال", "101 عال"] },
      { id: "published-2", courses: [{ code: "201 عال", prerequisites: ["101 عال"], corequisites: ["102 عال"] }] },
    ],
    fallbackCourses: Object.fromEntries(["101 عال", "102 عال", "201 عال"].map((code) => [code, {
      name: code,
      academicHours: 3,
      lectureHours: 3,
      exerciseHours: 0,
      practicalHours: 0,
    }])),
    proposal: {
      semesters: [
        { id: "one", sourceSemesterId: "published-1", type: "regular", courseOrder: ["major:plan:published-1:102-عال"], placeholders: [] },
        { id: "summer", sourceSemesterId: null, type: "summer", courseOrder: ["major:plan:published-2:201-عال"], placeholders: [{ id: "p", name: "نائب", academicHours: 3, lectureHours: 0, exerciseHours: 0, practicalHours: 0 }] },
        { id: "two", sourceSemesterId: "published-2", type: "regular", courseOrder: ["major:plan:published-1:101-عال"], placeholders: [] },
      ],
    },
  });
  const diagnostics = createDiagnostics();
  const resolved = resolvePlan(base, new Map(), colors, diagnostics);
  assert.equal(diagnostics.summary.errors, 0);
  assert.deepEqual(resolved.proposal.semesters[0].courses.map((course) => course.code), ["102 عال"]);
  assert.deepEqual(resolved.proposal.semesters[1].courses.map((course) => course.code), ["201 عال", "مقرر"]);
  assert.equal(resolved.proposal.semesters[1].name, "فصل صيفي");
  assert.ok(diagnostics.items.some((item) => item.code === "PROPOSAL_PREREQUISITE_AFTER_COURSE"));
  assert.ok(diagnostics.items.some((item) => item.code === "PROPOSAL_COREQUISITE_SEPARATED"));
  assert.deepEqual(
    new Set(resolved.proposal.semesters.flatMap((semester) => semester.courses.filter((course) => !course.isPlaceholder).map((course) => course.code))),
    new Set(["101 عال", "102 عال", "201 عال"]),
  );
});

test("proposal blocks orphaned placeholders after a published semester is removed", () => {
  const plan = normalizePlanInput({
    schemaVersion: 1,
    major: "مقترح",
    semesters: [{ id: "published-1", courses: [] }],
    proposal: {
      semesters: [{
        id: "removed-level",
        sourceSemesterId: "published-removed",
        type: "regular",
        courseOrder: [],
        placeholders: [{ id: "p", name: "نائب", academicHours: 3, lectureHours: 0, exerciseHours: 0, practicalHours: 0 }],
      }],
    },
  });
  const diagnostics = createDiagnostics();
  resolvePlan(plan, new Map(), colors, diagnostics);
  assert.ok(diagnostics.items.some((item) => item.code === "PROPOSAL_ORPHANED_PLACEHOLDERS" && item.severity === "errors"));
});

test("elective requirements accept hours or custom text but not both", () => {
  const facts = { name: "اختياري", academicHours: 3, lectureHours: 3, exerciseHours: 0, practicalHours: 0 };
  const valid = normalizePlanInput({
    schemaVersion: 1,
    major: "اختياري",
    semesters: [{ courses: [] }],
    electiveGroups: [
      { name: "بالساعات", requiredHours: 8, courses: ["101 حر"] },
      { name: "بالنص", requirementText: "غير متطلب للتخرج", courses: ["102 حر"] },
    ],
    fallbackCourses: { "101 حر": facts, "102 حر": facts },
  });
  const diagnostics = createDiagnostics();
  const resolved = resolvePlan(valid, new Map(), colors, diagnostics);
  assert.equal(resolved.electiveGroups[0].requiredHours, 8);
  assert.equal(resolved.electiveGroups[1].requirementText, "غير متطلب للتخرج");
  assert.equal(diagnostics.summary.errors, 0);
});

test("plans inherit shared edition and release settings", () => {
  const plan = normalizePlanInput({ schemaVersion: 1, major: "إعدادات", semesters: [{ courses: [] }] });
  const resolved = resolvePlan(plan, new Map(), colors, createDiagnostics(), {
    settings: { edition: "الطبعة الخامسة", release: "إصدار 500" },
  });
  assert.equal(resolved.edition, "الطبعة الخامسة");
  assert.equal(resolved.release, "إصدار 500");
  assert.equal(plan.edition, undefined);
  assert.equal(plan.release, undefined);
});

test("manual activity facts normalize missing siblings to explicit zero", () => {
  const plan = normalizePlanInput({
    schemaVersion: 1,
    major: "يدوي",
    semesters: [{ courses: ["999 جدد"] }],
    fallbackCourses: {
      "999 جدد": { name: "مقرر جديد", academicHours: 3, lectureHours: 2, exerciseHours: 0 },
    },
  });
  const diagnostics = createDiagnostics();
  resolvePlan(plan, new Map(), colors, diagnostics);
  const resolved = resolvePlan(plan, new Map(), colors, diagnostics);
  const course = resolved.semesters[0].courses[0];
  assert.equal(course.lectureHours, 2);
  assert.equal(course.exerciseHours, 0);
  assert.equal(course.practicalHours, 0);
  assert.equal(diagnostics.summary.errors, 0);
  assert.ok(diagnostics.items.some((diagnostic) => diagnostic.code === "ACTIVITY_HOURS_NORMALIZED"));
});

test("all three unknown activity values remain unknown and produce a non-blocking display warning", () => {
  const plan = normalizePlanInput({
    schemaVersion: 1,
    major: "مجهول",
    semesters: [{ courses: ["999 جدد"] }],
    fallbackCourses: { "999 جدد": { name: "مقرر جديد", academicHours: 3 } },
  });
  const diagnostics = createDiagnostics();
  const resolved = resolvePlan(plan, new Map(), colors, diagnostics);
  assert.equal(resolved.semesters[0].courses[0].lectureHours, null);
  assert.equal(diagnostics.summary.errors, 0);
  assert.ok(diagnostics.items.some((item) => (
    item.code === "UNKNOWN_ACTIVITY_HOURS" && item.severity === "warnings"
  )));
});

test("non-university electives without catalog activity facts use dashes and the extinct marker", () => {
  const plan = normalizePlanInput({
    schemaVersion: 1,
    major: "مجهول",
    semesters: [{ courses: [] }],
    electiveGroups: [
      { name: "متطلبات القسم", requiredHours: 2, courses: ["431 عمر"] },
      { name: "متطلبات الجامعة", requiredHours: 2, courses: ["101 سلم"] },
    ],
    fallbackCourses: {
      "431 عمر": { name: "اختياري قسم", academicHours: 2 },
      "101 سلم": { name: "اختياري جامعة", academicHours: 2 },
    },
  });

  const resolved = resolvePlan(plan, new Map(), colors, createDiagnostics());
  const departmentCourse = resolved.electiveGroups[0].courses[0];
  const universityCourse = resolved.electiveGroups[1].courses[0];

  assert.equal(departmentCourse.academicHours, 2);
  assert.equal(departmentCourse.hoursDisplay, "unknown");
  assert.equal(departmentCourse.isExtinct, true);
  assert.equal(universityCourse.hoursDisplay, "known");
  assert.equal(universityCourse.isExtinct, false);
});
