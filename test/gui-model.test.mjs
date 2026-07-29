import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPublishedDecisionSemesters,
  sortPublishedCollections,
} from "../gui/plan-model.mjs";
import {
  createProposalFromPublished,
  createProposalSemester,
  createElectivePlaceholder,
  dropProposalCourse,
  moveProposalCourse,
  proposalElectiveOptions,
  resetProposalToPublished,
} from "../gui/proposal-actions.mjs";

test("published GUI collections sort by number then Arabic subject", () => {
  const plan = {
    semesters: [{ courses: ["101 أ", "100 ي", "101 ب"] }],
    electiveGroups: [{ id: "custom", courses: ["202 ب", "201 ي"] }, { sourceId: "shared" }],
  };
  sortPublishedCollections(plan);
  assert.deepEqual(plan.semesters[0].courses, ["100 ي", "101 أ", "101 ب"]);
  assert.deepEqual(plan.electiveGroups[0].courses, ["201 ي", "202 ب"]);
});

test("published GUI semesters honor the selected shared-plan order", () => {
  const published = buildPublishedDecisionSemesters({
    sharedSemesterSets: ["common-second", "common-first"],
    semesters: [{ id: "major-1", courses: [] }],
  }, [
    { id: "common-first", semesters: [{ id: "first-1", courses: [] }] },
    { id: "common-second", semesters: [{ id: "second-1", courses: [] }] },
  ]);

  assert.deepEqual(published.map((semester) => semester.id), [
    "shared-common-second-second-1",
    "shared-common-first-first-1",
    "major-1",
  ]);
});

test("proposal actions preserve the parent course set while allowing movement", () => {
  const published = buildPublishedDecisionSemesters({
    id: "major",
    sharedSemesterSets: [],
    semesters: [
      { id: "level-1", courses: [{ id: "c1", code: "101 أ" }, { id: "c2", code: "102 أ" }] },
      { id: "level-2", courses: [{ id: "c3", code: "201 أ" }] },
    ],
  }, []);
  const proposal = createProposalFromPublished(published);
  proposal.semesters.push(createProposalSemester("summer"));

  assert.equal(moveProposalCourse({
    proposal,
    publishedSemesters: published,
    fromIndex: 1,
    courseId: "c3",
    action: "next",
  }), true);
  assert.deepEqual(proposal.semesters[2].courseOrder, ["c3"]);
  assert.equal(proposal.semesters.flatMap((semester) => semester.courseOrder).length, 3);

  assert.equal(dropProposalCourse({
    proposal,
    fromIndex: 0,
    targetIndex: 0,
    courseId: "c2",
    beforeCourseId: "c1",
  }), true);
  assert.deepEqual(proposal.semesters[0].courseOrder, ["c2", "c1"]);

  proposal.semesters[0].placeholders.push({ id: "p1", name: "من متطلبات المسار" });
  const reset = resetProposalToPublished(proposal, published);
  assert.deepEqual(reset[0].courseOrder, ["c1", "c2"]);
  assert.deepEqual(reset[0].placeholders, [{ id: "p1", name: "من متطلبات المسار" }]);
});

test("proposal elective helpers add one typical course until a group reaches zero", () => {
  const proposal = {
    semesters: [{ placeholders: [] }],
  };
  const groups = [{
    id: "track",
    name: "اختياري التخصص",
    requiredHours: 6,
    courses: [{ academicHours: 3 }, { academicHours: 3 }, { academicHours: 4 }],
  }];

  let [option] = proposalElectiveOptions(groups, proposal);
  assert.deepEqual(option, {
    id: "track",
    name: "اختياري التخصص",
    remainingHours: 6,
    allocationHours: 3,
  });
  proposal.semesters[0].placeholders.push(createElectivePlaceholder(option, "p1"));

  [option] = proposalElectiveOptions(groups, proposal);
  assert.equal(option.remainingHours, 3);
  proposal.semesters[0].placeholders.push(createElectivePlaceholder(option, "p2"));

  assert.deepEqual(proposalElectiveOptions(groups, proposal), []);
  assert.deepEqual(proposal.semesters[0].placeholders[0], {
    id: "p1",
    name: "من اختياري التخصص",
    electiveGroupId: "track",
    allocationHours: 3,
    hoursDisplay: "unknown",
    color: "#000000",
  });
});
