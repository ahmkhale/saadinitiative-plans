import test from "node:test";
import assert from "node:assert/strict";
import { calculatePage, renderPlanDocumentSvg, renderPlanSvg } from "../src/render-svg.mjs";
import {
  COURSE_CARD_LAYOUT,
  ELECTIVE_LAYOUT,
  PAGE_LAYOUT,
  SEMESTER_LAYOUT,
  calculateSemesterLayouts,
  electiveGroupHeight,
  electiveTop,
  semesterBodyHeight,
} from "../src/render-layout.mjs";
import { courseNameFit, measureText, prerequisiteFit } from "../src/text-measure.mjs";
import { formatCourseRequirementLabel } from "../src/domain/course-requirements.mjs";

function course(overrides = {}) {
  const value = {
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
  return { ...value, requirementLabel: formatCourseRequirementLabel(value) };
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

test("keeps width fixed while deriving page height from content", () => {
  const plan = {
    major: "اختبار",
    degree: "البكالوريوس",
    semesters: [{ name: "المستوى الأول", academicHours: 0, cumulativeHours: 0, courses: [] }],
    electiveGroups: [],
  };
  const layout = calculatePage(plan);
  const svg = renderPlanSvg(plan);
  assert.equal(layout.width, 594);
  assert.equal(layout.height, 271);
  assert.match(svg, /width="594pt" height="271pt" viewBox="0 0 594 271"/);
});

test("exposes the measured Figma layout instead of provisional approximations", () => {
  assert.deepEqual(PAGE_LAYOUT, {
    width: 594,
    innerX: 15,
    innerY: 24,
    innerWidth: 564,
    headerHeight: 42,
    contentTop: 98,
    sectionGap: 32,
    footerGap: 32,
    footerHeight: 84,
    pageGap: 10,
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
  assert.equal((svg.match(/data-part="metric-outline"/gu) ?? []).length, 0);
  assert.equal((svg.match(/data-part="guide-activity-outline"/gu) ?? []).length, 0);
  assert.doesNotMatch(svg, /data-part="(?:academic-badge|metric-box)"[^>]+opacity=/u);
  assert.doesNotMatch(svg, /<text[^>]+opacity="0\.9"/u);
  assert.match(svg, /data-part="academic-badge"[^>]+fill="#8BA9CD"/u);
  assert.match(svg, /data-part="metric-box"[^>]+fill="#8BA9CD"/u);
  assert.match(svg, /x="68\.5"[^>]+fill="#0E1114"/u);
  assert.match(svg, /translate\(33\.75701904296875 102\)/);
  assert.match(svg, /data-part="parent-marker" cx="5" cy="10" r="4"/);
  assert.match(svg, /data-part="track-marker" cx="5" cy="45" r="4"/);
  assert.match(svg, /data-part="extinct-marker" cx="71" cy="45" r="4"/);
  assert.match(svg, /data-part="prerequisite-pill"[^>]+height="11"[^>]+rx="6"/);
});

test("renders the cyan activity outline only in the explanatory guide", () => {
  const document = renderPlanDocumentSvg({
    major: "اختبار",
    degree: "البكالوريوس",
    semesters: [semester()],
    electiveGroups: [],
    proposal: { enabled: true, showGuide: true, semesters: [semester()] },
  });
  assert.equal((document.pages[0].match(/data-part="guide-activity-outline"/gu) ?? []).length, 0);
  assert.equal((document.pages[1].match(/data-part="guide-activity-outline"/gu) ?? []).length, 1);
  assert.equal((document.pages.join("").match(/data-part="metric-outline"/gu) ?? []).length, 0);
});

test("places automatically sorted courses in Arabic reading order", () => {
  const svg = renderPlanSvg({
    major: "اختبار",
    degree: "البكالوريوس",
    semesters: [semester({
      courseDisplayOrder: "rtl",
      courses: [course({ code: "100 ي" }), course({ code: "101 أ" })],
    })],
    electiveGroups: [],
  });
  const xFor = (code) => Number(svg.match(new RegExp(`data-course-code="${code}" transform="translate\\(([^ ]+)`, "u"))?.[1]);
  assert.ok(xFor("100 ي") > xFor("101 أ"), "the lower course number should be the rightmost/first card");
});

test("fits long course and prerequisite text without changing card or pill geometry", () => {
  const longName = "مقدمة شاملة في برمجة الحاسبات وتطبيقاتها الهندسية المتقدمة";
  const svg = renderPlanSvg({
    major: "اختبار",
    degree: "البكالوريوس",
    semesters: [semester({
      courses: [course({
        name: longName,
        prerequisites: ["101 تقن", "113 عال"],
        corequisites: ["114 عال"],
      })],
    })],
    electiveGroups: [],
  });

  const nameTag = svg.match(/<text[^>]*data-part="course-name"[^>]*>/u)?.[0] ?? "";
  const prerequisiteTag = svg.match(/<text[^>]*data-part="prerequisite-label"[^>]*>/u)?.[0] ?? "";
  assert.match(nameTag, /font-size="(?!5")[^"]+"/u);
  assert.match(prerequisiteTag, /font-size="(?!4\.5")[^"]+"/u);
  assert.doesNotMatch(nameTag, /textLength=/u);
  assert.doesNotMatch(prerequisiteTag, /textLength=/u);
  assert.match(svg, /data-part="course-body" x="1" y="6" width="74" height="43" rx="6"/u);
  assert.match(svg, /data-part="prerequisite-pill"[^>]+width="51"[^>]+height="11"[^>]+rx="6"/u);
  assert.ok(svg.includes(longName));
  assert.ok(svg.includes("101 تقن | 113 عال | 114 عال مرافق"));
  assert.ok(!svg.includes("…"));
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
  assert.equal(electiveTop(calculateSemesterLayouts(semesters)), 614);
  assert.equal(electiveGroupHeight(electiveGroups[0]), 112);
  assert.equal(electiveGroupHeight(electiveGroups[1]), 59);
  assert.equal(ELECTIVE_LAYOUT.groupGap, 16);
  assert.match(svg, /data-component="semester-summary"/);
  assert.match(svg, /data-part="summary-title" d="M499\.75701904296875 98 /);
  assert.equal((svg.match(/data-component="year-rail"/gu) ?? []).length, 4);
  assert.equal((svg.match(/data-component="elective-group"/gu) ?? []).length, 2);
  const layout = calculatePage({ semesters, electiveGroups });
  assert.equal(layout.footerY, 833);
  assert.match(svg, /x="0" y="911" width="594" height="6"/);
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
        name: `المستوى ${index + 1}`,
      })),
    },
  });
  assert.equal(document.pageCount, 2);
  assert.equal((document.svg.match(/<inkscape:page /g) ?? []).length, 2);
  assert.equal(document.pageLayouts[0].height, 271);
  assert.equal(document.pageLayouts[1].height, 983.748779296875);
  assert.match(document.svg, /<inkscape:page x="0" y="0" width="594" height="271"\/>/);
  assert.match(document.svg, /<inkscape:page x="0" y="281" width="594" height="983\.748779296875"\/>/);
  assert.match(document.pages[1], /data-component="course-guide"/);
  assert.match(document.pages[1], /نصف سنة/);
  assert.doesNotMatch(document.pages[1], /فصل صيفي/);
  assert.match(document.pages[1], /x1="238\.26885986328125" y1="694\.7333984375" x2="211\.95730209350586" y2="694\.7333984375"/);
  assert.match(document.pages[1], /x1="514\.5401611328125" y1="817\.833984375" x2="334\.99999210272654" y2="764\.9997519717253"/);
  assert.match(document.pages[1], /data-part="guide-activity-outline" x="270\.2186279296875" y="756\.7537841796875" width="64\.83919525146484" height="16\.914573669433594" rx="3\.758794069290161" fill="none" stroke="#00AEEF" stroke-width="0\.9396985173225403"/);
  assert.match(document.pages[1], /font-kerning="normal"/);
  const ids = allIds(document.svg);
  assert.equal(new Set(ids).size, ids.length);
});

test("grows published pages for semesters, elective groups, and wrapped elective rows", () => {
  const sixSemesters = Array.from({ length: 6 }, () => semester());
  const eightSemesters = Array.from({ length: 8 }, () => semester());
  const noElectives = calculatePage({ semesters: sixSemesters, electiveGroups: [] });
  const eightLevels = calculatePage({ semesters: eightSemesters, electiveGroups: [] });
  const oneRow = calculatePage({
    semesters: sixSemesters,
    electiveGroups: [{ name: "اختياري", requiredHours: 3, courses: Array.from({ length: 6 }, () => course()) }],
  });
  const twoRows = calculatePage({
    semesters: sixSemesters,
    electiveGroups: [{ name: "اختياري", requiredHours: 3, courses: Array.from({ length: 7 }, () => course()) }],
  });
  const secondGroup = calculatePage({
    semesters: sixSemesters,
    electiveGroups: [
      { name: "اختياري أ", requiredHours: 3, courses: [course()] },
      { name: "اختياري ب", requiredHours: 3, courses: [course()] },
    ],
  });

  assert.equal(noElectives.width, 594);
  assert.ok(noElectives.height < eightLevels.height);
  assert.ok(oneRow.height > noElectives.height);
  assert.equal(twoRows.height - oneRow.height, COURSE_CARD_LAYOUT.height + ELECTIVE_LAYOUT.rowGap);
  assert.ok(secondGroup.height > oneRow.height);
});

test("grows proposal pages independently for an additional published level and guide content", () => {
  const regular = Array.from({ length: 8 }, () => semester());
  const ninthLevel = semester({ name: "المستوى التاسع" });
  const base = {
    major: "اختبار",
    semesters: [semester()],
    proposal: { semesters: regular, showGuide: false },
  };
  const withoutGuide = calculatePage(base, { proposal: true });
  const withNinthLevel = calculatePage({
    ...base,
    proposal: { semesters: [...regular, ninthLevel], showGuide: false },
  }, { proposal: true });
  const withGuide = calculatePage({
    ...base,
    proposal: { semesters: regular, showGuide: true },
  }, { proposal: true });

  assert.equal(withoutGuide.width, 594);
  assert.ok(withNinthLevel.height > withoutGuide.height);
  assert.equal(withGuide.height - withoutGuide.height, PAGE_LAYOUT.sectionGap + 192.748779296875);
  assert.notEqual(calculatePage(base).height, withGuide.height);
});

test("keeps every calculated section inside deterministic page bounds", () => {
  const plan = {
    major: "اختبار",
    semesters: Array.from({ length: 6 }, () => semester()),
    electiveGroups: [{ name: "اختياري", requiredHours: 3, courses: Array.from({ length: 8 }, () => course()) }],
  };
  const first = calculatePage(plan);
  const second = calculatePage(structuredClone(plan));
  assert.deepEqual(first, second);
  assert.ok(first.semesterBottom <= first.contentBottom);
  assert.ok(first.electivesY + first.electivesHeight <= first.contentBottom);
  assert.ok(first.contentBottom < first.footerY);
  assert.equal(first.footerY + PAGE_LAYOUT.footerHeight, first.height);
  const svg = renderPlanSvg(plan);
  assert.match(svg, new RegExp(`height="${first.height}pt"`));
});

test("renders full-year and half-year rails for even and odd semester counts", () => {
  const even = renderPlanSvg({ major: "زوجي", semesters: [semester(), semester()] });
  assert.match(even, />1<\/text>/u);
  assert.match(even, />سنة<\/text>/u);
  assert.doesNotMatch(even, /نصف سنة/u);

  const odd = renderPlanSvg({ major: "فردي", semesters: [semester(), semester(), semester()] });
  assert.match(odd, /نصف سنة/u);
  assert.doesNotMatch(odd, />2<\/text><text[^>]*>سنة/u);
});

test("renders elective custom requirement text", () => {
  const svg = renderPlanSvg({
    major: "اختياري",
    semesters: [semester()],
    electiveGroups: [{ name: "إثرائي", requirementText: "غير متطلب للتخرج", courses: [course()] }],
  });
  assert.match(svg, /غير متطلب للتخرج/u);
  assert.doesNotMatch(svg, /إتمام 0 ساعات/u);
});

test("wraps unlimited semester rows using the exact Figma formula", () => {
  assert.deepEqual([0, 1, 6, 7, 12, 13].map(semesterBodyHeight), [57, 57, 57, 110, 110, 163]);
  const courses = Array.from({ length: 13 }, (_, index) => course({ code: `${101 + index} عال` }));
  const next = semester({ name: "المستوى الثاني", courses: [course({ code: "201 عال" })] });
  const plan = { major: "التفاف", semesters: [semester({ courses }), next], electiveGroups: [] };
  const layout = calculatePage(plan);
  const svg = renderPlanSvg(plan);
  assert.equal(layout.semesterLayouts[0].rowCount, 3);
  assert.equal(layout.semesterLayouts[0].courseBodyHeight, 163);
  assert.equal(layout.semesterLayouts[1].y, 265);
  assert.equal((svg.match(/data-component="course-card"/gu) ?? []).length, 14);
  const seventhX = Number(svg.match(/data-course-code="107 عال" transform="translate\(([^ ]+)/u)?.[1]);
  const thirteenthX = Number(svg.match(/data-course-code="113 عال" transform="translate\(([^ ]+)/u)?.[1]);
  assert.equal(seventhX, COURSE_CARD_LAYOUT.rowRight - COURSE_CARD_LAYOUT.width);
  assert.equal(thirteenthX, COURSE_CARD_LAYOUT.rowRight - COURSE_CARD_LAYOUT.width);
  assert.match(svg, /data-row-count="3" data-body-height="163"/u);
  assert.match(svg, /data-component="semester-summary"/u);
});

test("fits Arabic text with shaped glyph advances and a readable floor", () => {
  const fitting = courseNameFit("برمجة حاسبات");
  assert.equal(fitting.size, 5);
  const slightlyLong = courseNameFit("تصميم البرمجيات المعتمدة على المكونات");
  assert.ok(slightlyLong.size < 5 && slightlyLong.size >= 2.75);
  assert.ok(measureText("سلام", 5, "semibold") !== measureText("سسسس", 5, "semibold"));
  assert.ok(measureText("تصميم البرمجيات المعتمدة على المكونات", slightlyLong.size, "semibold") <= 68);
  assert.ok(measureText("تصميم البرمجيات المعتمدة على المكونات", slightlyLong.size + 0.002, "semibold") > 68);
  const long = courseNameFit("مقدمة شاملة جدًا في هندسة البرمجيات وتطبيقات الأنظمة الموزعة المتقدمة للغاية");
  assert.ok(long.size >= 2.75);
  const prerequisite = prerequisiteFit("101 عال | 102 عال مرافق | إتمام 60 ساعة", 43);
  assert.ok(prerequisite.size >= 3.5);
});

test("wraps every complete footer item in an absolute SVG link", () => {
  const document = renderPlanDocumentSvg({
    major: "روابط",
    semesters: [semester()],
    proposal: { semesters: [semester()], showGuide: false },
  });
  const destinations = [
    "https://t.me/SaadInitiative?direct",
    "https://x.com/saadinitiative",
    "https://saadinitiative.com",
    "https://t.me/saadinitiative",
  ];
  for (const page of document.pages) {
    assert.equal((page.match(/data-part="footer-hit-area"/gu) ?? []).length, 4);
    for (const destination of destinations) {
      assert.ok(page.includes(`href="${destination.replace("&", "&amp;")}"`));
      assert.ok(page.includes(`xlink:href="${destination.replace("&", "&amp;")}"`));
      assert.ok(page.includes('rel="noopener noreferrer"'));
      assert.ok(page.includes('pointer-events="all"'));
    }
  }
});
