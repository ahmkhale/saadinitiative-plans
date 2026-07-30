import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyRequirementCourses,
  formatCourseRequirementLabel,
} from "../src/domain/course-requirements.mjs";

test("merged requirements classify same-level courses as corequisites", () => {
  const classified = classifyRequirementCourses(
    ["101 ريض", "204 فيز", "101 ريض", "301 عال"],
    [{ code: "204 فيز" }, { code: "210 كيم" }],
  );

  assert.deepEqual(classified, {
    prerequisites: ["101 ريض", "301 عال"],
    corequisites: ["204 فيز"],
    forcedCorequisites: [],
    prerequisiteAlternatives: [],
  });
});

test("merged requirements default to prerequisites when no published level applies", () => {
  assert.deepEqual(classifyRequirementCourses(["101 ريض"], []), {
    prerequisites: ["101 ريض"],
    corequisites: [],
    forcedCorequisites: [],
    prerequisiteAlternatives: [],
  });
});

test("hash forces a course to remain a corequisite outside its level", () => {
  assert.deepEqual(classifyRequirementCourses(["101 ريض", "# 201 فيز"], []), {
    prerequisites: ["101 ريض"],
    corequisites: ["201 فيز"],
    forcedCorequisites: ["201 فيز"],
    prerequisiteAlternatives: [],
  });
});

test("caret creates prerequisite alternatives without changing comma semantics", () => {
  const classified = classifyRequirementCourses(
    ["101 ريض", "201 فيز ^ 202 فيز"],
    [{ code: "202 فيز" }],
  );

  assert.deepEqual(classified, {
    prerequisites: ["101 ريض"],
    corequisites: [],
    forcedCorequisites: [],
    prerequisiteAlternatives: [["201 فيز", "202 فيز"]],
  });
  assert.equal(formatCourseRequirementLabel(classified), "101 ريض | 201 فيز أو 202 فيز");
});
