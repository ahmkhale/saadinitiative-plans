import test from "node:test";
import assert from "node:assert/strict";
import { compareCourseCodes, courseCodeKey, normalizeCourseCode } from "../src/normalize.mjs";

test("normalizes Arabic digits and subject-first codes", () => {
  assert.equal(normalizeCourseCode("١٠١   ريض"), "101 ريض");
  assert.equal(normalizeCourseCode("كهر 201"), "201 كهر");
  assert.equal(courseCodeKey("١٠٣ إحص"), courseCodeKey("103 احص"));
});

test("sorts by catalog number then Arabic subject", () => {
  const values = ["210 تم", "101 ريض", "101 عرب", "103 فيز", "100 ي"];
  assert.deepEqual(values.sort(compareCourseCodes), ["100 ي", "101 ريض", "101 عرب", "103 فيز", "210 تم"]);
});
