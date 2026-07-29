import assert from "node:assert/strict";
import test from "node:test";
import { courseBadges, renderCourseRow } from "../gui/course-view.mjs";
import { escapeHtml } from "../gui/html.mjs";

const baseArgs = {
  entry: { id: "course-1", code: "204 ريض", fallback: { name: "المعادلات التفاضلية" } },
  kind: "semester",
  groupIndex: 0,
  courseIndex: 0,
  plan: { electiveGroups: [] },
  fallbackCourses: {},
  escapeHtml,
};

test("course badges can render resolved catalog data without an injected escape helper", () => {
  const html = courseBadges({
    sourceBadge: "دليل الطلاب",
    qualityBadges: ["بيانات متعارضة"],
    catalogSource: "male",
  }, false);

  assert.match(html, /دليل الطلاب/u);
  assert.match(html, /source-badge male/u);
  assert.match(html, /بيانات متعارضة/u);
});

test("course rows show a neutral pending state before preview resolution", () => {
  const html = renderCourseRow({ ...baseArgs, resolved: null });

  assert.match(html, /course-row pending/u);
  assert.match(html, /جارٍ التحقق من الدليل/u);
  assert.match(html, /المعادلات التفاضلية/u);
  assert.doesNotMatch(html, /course-row unresolved/u);
  assert.doesNotMatch(html, /<details[^>]*open/u);
});

test("course rows reserve the missing state for a confirmed unresolved course", () => {
  const html = renderCourseRow({
    ...baseArgs,
    resolved: {
      code: "999 ريض",
      source: "unresolved",
      sourceBadge: "غير موجود في الدليل",
      qualityBadges: [],
      prerequisites: [],
    },
  });

  assert.match(html, /course-row unresolved/u);
  assert.match(html, /غير موجود في الدليل/u);
  assert.match(html, /<details[^>]*open/u);
});

test("elective proposal placeholders display dashes instead of zero-hour facts", () => {
  const html = renderCourseRow({
    ...baseArgs,
    entry: { kind: "placeholder", placeholderId: "p1", code: "مقرر" },
    kind: "proposal",
    resolved: {
      code: "مقرر",
      name: "من اختياري التخصص",
      isPlaceholder: true,
      hoursDisplay: "unknown",
      academicHours: 3,
      lectureHours: null,
      exerciseHours: null,
      practicalHours: null,
      prerequisites: [],
    },
  });

  assert.match(html, /3 ساعات · محاضرة — · عملي — · تمارين —/u);
  assert.doesNotMatch(html, /محاضرة 0/u);
});

test("non-university elective rows require identity facts but leave weekly hours optional", () => {
  const html = renderCourseRow({
    ...baseArgs,
    kind: "elective",
    electiveGroupName: "متطلبات القسم",
    resolved: {
      code: "431 عمر",
      source: "unresolved",
      sourceBadge: "غير موجود في الدليل",
      qualityBadges: [],
      prerequisites: [],
    },
  });

  assert.match(html, /data-manual-fact="name"[^>]+required/u);
  assert.match(html, /data-manual-fact="academicHours"[^>]+required/u);
  assert.doesNotMatch(html, /data-manual-fact="lectureHours"[^>]+required/u);
  assert.doesNotMatch(html, /data-manual-fact="exerciseHours"[^>]+required/u);
  assert.doesNotMatch(html, /data-manual-fact="practicalHours"[^>]+required/u);
});

test("university elective rows still require weekly hours when unresolved", () => {
  const html = renderCourseRow({
    ...baseArgs,
    kind: "elective",
    electiveGroupName: "متطلبات الجامعة",
    resolved: {
      code: "101 سلم",
      source: "unresolved",
      sourceBadge: "غير موجود في الدليل",
      qualityBadges: [],
      prerequisites: [],
    },
  });

  assert.match(html, /data-manual-fact="lectureHours"[^>]+required/u);
  assert.match(html, /data-manual-fact="exerciseHours"[^>]+required/u);
  assert.match(html, /data-manual-fact="practicalHours"[^>]+required/u);
});
