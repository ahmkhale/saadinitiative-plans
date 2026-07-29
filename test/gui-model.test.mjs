import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPublishedDecisionSemesters,
  composeParentTrackPlan,
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
import { createProposalPlaceholderActions } from "../gui/proposal-placeholder-actions.mjs";

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
    publishedSemesters: published,
    fromIndex: 0,
    targetIndex: 1,
    courseId: "c2",
  }), true);
  assert.deepEqual(proposal.semesters[0].courseOrder, ["c1"]);
  assert.deepEqual(proposal.semesters[1].courseOrder, ["c2"]);
  assert.equal(dropProposalCourse({
    proposal,
    publishedSemesters: published,
    fromIndex: 1,
    targetIndex: 1,
    courseId: "c2",
  }), false);

  proposal.semesters[0].placeholders.push({ id: "p1", name: "من متطلبات المسار" });
  const reset = resetProposalToPublished(proposal, published);
  assert.deepEqual(reset[0].courseOrder, ["c1", "c2"]);
  assert.deepEqual(reset[0].placeholders, [{ id: "p1", name: "من متطلبات المسار" }]);
});

test("proposal course order is automatic within every level", () => {
  const published = [{
    id: "published",
    courses: [
      { id: "c497", code: "497 عال" },
      { id: "c453", code: "453 عال" },
      { id: "c479", code: "479 عال" },
    ],
  }];
  const proposal = createProposalFromPublished(published);

  assert.deepEqual(proposal.semesters[0].courseOrder, ["c453", "c479", "c497"]);
  assert.equal(moveProposalCourse({
    proposal,
    publishedSemesters: published,
    fromIndex: 0,
    courseId: "c479",
    action: "up",
  }), false);
  assert.deepEqual(proposal.semesters[0].courseOrder, ["c453", "c479", "c497"]);
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
    hasVariableCourseHours: true,
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

test("proposal elective options only flag groups with differing course hours", () => {
  const groups = [
    {
      id: "equal",
      name: "متساوية",
      requiredHours: 6,
      courses: [{ academicHours: 3 }, { academicHours: 3 }],
    },
    {
      id: "variable",
      name: "متفاوتة",
      requiredHours: 8,
      courses: [{ academicHours: 1 }, { academicHours: 2 }, { academicHours: 3 }, { academicHours: 5 }],
    },
  ];

  const options = proposalElectiveOptions(groups, { semesters: [] });
  assert.equal(options[0].hasVariableCourseHours, false);
  assert.equal(options[1].hasVariableCourseHours, true);
});

test("proposal elective options distinguish colliding parent and track group ids", () => {
  const composed = composeParentTrackPlan({
    id: "cs",
    electiveGroups: [{ id: "elective-group-2", name: "متطلبات علمية" }],
  }, {
    track: { id: "general" },
    electiveGroups: [{ id: "elective-group-2", name: "متطلبات المسار العام" }],
  });
  const groups = composed.electiveGroups.map((group) => ({
    ...group,
    requiredHours: 3,
    courses: [{ academicHours: 3 }],
  }));
  const options = proposalElectiveOptions(groups, { semesters: [] });

  assert.deepEqual(options.map((option) => option.id), [
    "elective-group-2",
    "track:general:elective:elective-group-2",
  ]);
  const proposal = { semesters: [{ placeholders: [
    createElectivePlaceholder(options[1], "track-placeholder"),
  ] }] };
  assert.deepEqual(proposalElectiveOptions(groups, proposal).map((option) => option.name), [
    "متطلبات علمية",
  ]);
});

test("proposal placeholder action asks for and applies hours only for a variable-hours group", async () => {
  const state = {
    resolved: {
      electiveGroups: [
        {
          id: "equal",
          name: "متساوية",
          requiredHours: 6,
          courses: [{ academicHours: 3 }, { academicHours: 3 }],
        },
        {
          id: "variable",
          name: "متفاوتة",
          requiredHours: 8,
          courses: [{ academicHours: 1 }, { academicHours: 2 }, { academicHours: 3 }, { academicHours: 5 }],
        },
      ],
    },
    plan: {
      proposal: {
        semesters: [{ placeholders: [] }],
      },
    },
  };
  let fields;
  const actions = createProposalPlaceholderActions({
    state,
    askForm: async (request) => {
      fields = request.fields;
      return {
        electiveGroupId: "variable",
        "allocationHours:variable": "5",
      };
    },
    changed() {},
    setStatus() {},
  });

  await actions.addPlaceholder({ dataset: { groupIndex: "0" } });

  assert.equal(fields.some((field) => field.name === "allocationHours:equal"), false);
  assert.deepEqual(fields.find((field) => field.name === "allocationHours:variable"), {
    name: "allocationHours:variable",
    label: "الساعات المحتسبة من المتطلب",
    type: "number",
    min: 1,
    max: 8,
    step: 1,
    value: 5,
    visibleWhen: {
      name: "electiveGroupId",
      values: ["variable"],
    },
  });
  assert.equal(state.plan.proposal.semesters[0].placeholders[0].allocationHours, 5);
});
