import test from "node:test";
import assert from "node:assert/strict";
import { calculatePage, renderPlanDocumentSvg, renderPlanSvg } from "../src/render-svg.mjs";

test("renders the Figma-shaped course card and plan metadata", () => {
  const svg = renderPlanSvg({
    major: "هندسة كهربائية",
    university: "جامعة الملك سعود",
    college: "كلية الهندسة",
    degree: "البكالوريوس",
    totalHours: 3,
    courseCount: 1,
    semesterCount: 1,
    semesters: [{ name: "المستوى الأول", yearLabel: "السنة الأولى", academicHours: 3, cumulativeHours: 3, courses: [{
      code: "101 كهر", name: "مقدمة", academicHours: 3, lectureHours: 3, practicalHours: 0, exerciseHours: 0,
      prerequisites: [], corequisites: [], minimumCompletedCredits: null, color: "#17529B",
      isParentCourse: true, isTrackSpecific: false, isExtinct: false,
    }] }],
  });
  assert.match(svg, /width="74" height="43" rx="6"/);
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

test("builds an Inkscape multipage SVG for a proposed plan", () => {
  const semester = { name: "المستوى الأول", academicHours: 0, cumulativeHours: 0, courses: [] };
  const document = renderPlanDocumentSvg({
    major: "اختبار",
    degree: "البكالوريوس",
    semesters: [semester],
    electiveGroups: [],
    proposal: {
      title: "الخطة المقترحة",
      semesters: Array.from({ length: 9 }, (_, index) => ({ ...semester, name: index === 8 ? "صيفي" : `المستوى ${index + 1}` })),
    },
  });
  assert.equal(document.pageCount, 2);
  assert.equal((document.svg.match(/<inkscape:page /g) ?? []).length, 2);
  assert.match(document.svg, /height="1044\.5pt"/);
});
