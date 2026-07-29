import assert from "node:assert/strict";
import test from "node:test";
import { classifyRequirementCourses } from "../src/domain/course-requirements.mjs";

test("merged requirements classify same-level courses as corequisites", () => {
  const classified = classifyRequirementCourses(
    ["101 ريض", "204 فيز", "101 ريض", "301 عال"],
    [{ code: "204 فيز" }, { code: "210 كيم" }],
  );

  assert.deepEqual(classified, {
    prerequisites: ["101 ريض", "301 عال"],
    corequisites: ["204 فيز"],
  });
});

test("merged requirements default to prerequisites when no published level applies", () => {
  assert.deepEqual(classifyRequirementCourses(["101 ريض"], []), {
    prerequisites: ["101 ريض"],
    corequisites: [],
  });
});
