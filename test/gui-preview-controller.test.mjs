import assert from "node:assert/strict";
import test from "node:test";
import { courseDetailsOpenState } from "../gui/preview-controller.mjs";

test("course fact resolution leaves the details panel under user control", () => {
  assert.equal(courseDetailsOpenState({
    currentOpen: true,
    unresolved: false,
    wasPending: false,
    placeholder: false,
  }), true);
  assert.equal(courseDetailsOpenState({
    currentOpen: false,
    unresolved: false,
    wasPending: false,
    placeholder: false,
  }), false);
});

test("a newly confirmed unresolved course opens its fact editor", () => {
  assert.equal(courseDetailsOpenState({
    currentOpen: false,
    unresolved: true,
    wasPending: true,
    placeholder: false,
  }), true);
});
