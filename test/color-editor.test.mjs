import assert from "node:assert/strict";
import test from "node:test";
import { groupCourseColors, parseColorKeywords } from "../gui/color-editor.mjs";

test("course color keywords accept ampersands and Arabic commas", () => {
  assert.deepEqual(parseColorKeywords("إحص & احص، إنجل\nانجل"), ["إحص", "احص", "إنجل", "انجل"]);
});

test("course color rows group hamza spelling variants without grouping unrelated equal colors", () => {
  const groups = groupCourseColors({
    "إحص": "#165B86",
    "احص": "#165B86",
    "حسب": "#BD4235",
    "هعم": "#BD4235",
  });
  assert.ok(groups.some((group) => group.subjects.join(" & ") === "إحص & احص"));
  assert.ok(groups.some((group) => group.subjects.length === 1 && group.subjects[0] === "حسب"));
  assert.ok(groups.some((group) => group.subjects.length === 1 && group.subjects[0] === "هعم"));
});
