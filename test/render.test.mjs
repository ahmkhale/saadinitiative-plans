import test from "node:test";
import assert from "node:assert/strict";
import { calculatePage, renderPlanDocumentSvg, renderPlanSvg } from "../src/render-svg.mjs";
import {
  COURSE_CARD_LAYOUT,
  ELECTIVE_LAYOUT,
  PAGE_LAYOUT,
  SEMESTER_LAYOUT,
  electiveGroupHeight,
  electiveTop,
} from "../src/render-layout.mjs";

function course(overrides = {}) {
  return {
    code: "101 كهر",
    name: "مقدمة",
    academicHours: 3,
    lectureHours: 3,
    practicalHours: 0,
    exerciseHours: 0,
    prerequisites: [],
    corequisites: [],
    prerequisiteConditions: [],
    minimumCompletedCredits: null,
    color: "#17529B",
    isParentCourse: false,
    isTrackSpecific: false,
    isExtinct: false,
    ...overrides,
  };
}

function semester(overrides = {}) {
  return {
    name: "المستوى الأول",
    yearLabel: "السنة الأولى",
    academicHours: 3,
    cumulativeHours: 3,
    courses: [course()],
    ...overrides,
  };
}

function allIds(svg) {
  return [...svg.matchAll(/\sid="([^"]+)"/gu)].map((match) => match[1]);
}

test("renders the Figma-shaped course card and plan metadata", () => {
  const svg = renderPlanSvg({
    major: "هندسة كهربائية",
    university: "جامعة الملك سعود",
    college: "كلية الهندسة",
    degree: "البكالوريوس",
    totalHours: 3,
    courseCount: 1,
    semesterCount: 1,
    semesters: [semester({ courses: [course({ isParentCourse: true })] })],
  });
  assert.match(svg, /data-part="course-body" x="1" y="6" width="74" height="43" rx="6"/);
  assert.match(svg, /هندسة كهربائية/);
  assert.match(svg, /#17529B/);
});

test("uses the exact Figma page dimensions", () => {
  assert.deepEqual(calculatePage(), { width: 594, height: 1045, rows: 8, panelHeight: 57 });
  const svg = renderPlanSvg({
    major: "اختبار",
    degree: "البكالوريوس",
    semesters: [{ name: "المستوى الأول", academicHours: 0, cumulativeHours: 0, courses: [] }],
    electiveGroups: [],
  });
  assert.match(svg, /width="594pt" height="1045pt" viewBox="0 0 594 1045"/);
});

test("exposes the measured Figma layout instead of provisional approximations", () => {
  assert.deepEqual(PAGE_LAYOUT, {
    width: 594,
    height: 1045,
    innerX: 15,
    innerY: 24,
    innerWidth: 564,
    headerHeight: 42,
    contentTop: 98,
    footerY: 961,
    footerHeight: 84,
  });
  assert.equal(SEMESTER_LAYOUT.courseAreaWidth, 471.75701904296875);
  assert.equal(SEMESTER_LAYOUT.summaryWidth, 65.24298858642578);
  assert.equal(SEMESTER_LAYOUT.yearRailWidth, 12);
  assert.equal(COURSE_CARD_LAYOUT.width, 76);
  assert.equal(COURSE_CARD_LAYOUT.height, 49);
  assert.deepEqual(COURSE_CARD_LAYOUT.academicBadge.radii, [1, 6, 1, 6]);
  assert.equal(COURSE_CARD_LAYOUT.metrics.startX, 24);
  assert.equal(COURSE_CARD_LAYOUT.metrics.gap, 2);
});

test("renders exact card markers, metric boxes, prerequisite pill, and six-card spacing", () => {
  const courses = Array.from({ length: 6 }, (_, index) => course({
    code: `${101 + index} كهر`,
    prerequisites: index === 0 ? ["100 كهر"] : [],
    isParentCourse: index === 1,
    isTrackSpecific: index === 2,
    isExtinct: index === 3,
  }));
  const svg = renderPlanSvg({
    major: "اختبار",
    degree: "البكالوريوس",
    semesters: [semester({ courses })],
    electiveGroups: [],
  });
  assert.equal((svg.match(/data-component="course-card"/gu) ?? []).length, 6);
  assert.equal((svg.match(/data-part="metric-box"/gu) ?? []).length, 18);
  assert.match(svg, /translate\(33\.75701904296875 102\)/);
  assert.match(svg, /data-part="parent-marker" cx="5" cy="10" r="4"/);
  assert.match(svg, /data-part="track-marker" cx="5" cy="45" r="4"/);
  assert.match(svg, /data-part="extinct-marker" cx="71" cy="45" r="4"/);
  assert.match(svg, /data-part="prerequisite-pill"[^>]+height="11"[^>]+rx="6"/);
});

test("renders measured semester summary, rails, elective groups, and footer bounds", () => {
  const electiveGroups = [
    { name: "متطلبات الجامعة", requiredHours: 4, courses: Array.from({ length: 9 }, () => course()) },
    { name: "متطلبات المسار", requiredHours: 3, courses: Array.from({ length: 6 }, () => course()) },
  ];
  const semesters = Array.from({ length: 8 }, (_, index) => semester({
    name: `المستوى ${index + 1}`,
    cumulativeHours: (index + 1) * 3,
  }));
  const svg = renderPlanSvg({
    major: "اختبار",
    degree: "البكالوريوس",
    semesters,
    electiveGroups,
    phases: [
      { label: "السنة التحضيرية", start: 1, end: 2 },
      { label: "التخصص", start: 3, end: 8 },
    ],
  });
  assert.equal(electiveTop(8), 614);
  assert.equal(electiveGroupHeight(electiveGroups[0]), 112);
  assert.equal(electiveGroupHeight(electiveGroups[1]), 59);
  assert.equal(ELECTIVE_LAYOUT.groupGap, 16);
  assert.match(svg, /data-component="semester-summary"/);
  assert.match(svg, /data-part="summary-title" d="M499\.75701904296875 98 /);
  assert.equal((svg.match(/data-component="year-rail"/gu) ?? []).length, 4);
  assert.equal((svg.match(/data-component="elective-group"/gu) ?? []).length, 2);
  assert.match(svg, /x="0" y="1039" width="594" height="6"/);
});

test("keeps generated IDs unique and output deterministic", () => {
  const plan = {
    major: "اختبار",
    degree: "البكالوريوس",
    semesters: [semester({ courses: [course({ prerequisites: ["100 كهر"] }), course()] })],
    electiveGroups: [{ name: "اختياري", requiredHours: 3, courses: [course()] }],
  };
  const first = renderPlanSvg(plan);
  const second = renderPlanSvg(plan);
  const ids = allIds(first);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(first, second);
});

test("builds an Inkscape multipage SVG for a proposed plan", () => {
  const emptySemester = semester({ academicHours: 0, cumulativeHours: 0, courses: [] });
  const document = renderPlanDocumentSvg({
    major: "اختبار",
    degree: "البكالوريوس",
    semesters: [emptySemester],
    electiveGroups: [],
    proposal: {
      title: "الخطة المقترحة",
      semesters: Array.from({ length: 9 }, (_, index) => ({
        ...emptySemester,
        name: index === 8 ? "صيفي" : `المستوى ${index + 1}`,
      })),
    },
  });
  assert.equal(document.pageCount, 2);
  assert.equal((document.svg.match(/<inkscape:page /g) ?? []).length, 2);
  assert.match(document.svg, /height="1044\.5pt"/);
  assert.match(document.pages[1], /data-component="course-guide"/);
  assert.match(document.pages[1], /فصل صيفي/);
  const ids = allIds(document.svg);
  assert.equal(new Set(ids).size, ids.length);
});
