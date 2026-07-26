# Data model

## `plan.json` owns plan decisions

- which courses appear and in which semester;
- published-plan and optional proposed-plan placement;
- elective groups and their required hours;
- required/elective status;
- track-specific and extinct flags;
- phase and header labels;
- truly plan-specific overrides;
- fallbacks for courses absent from the catalog;
- black placeholder cards used by proposed plans.

## `courses.json` owns reusable course facts

- canonical name;
- academic and contact hours;
- prerequisites and corequisites when available;
- catalog status and category.

## Resolved output owns derived facts

- normalized code and subject;
- selected source (`catalog`, `fallback`, `placeholder`, or `unresolved`);
- Figma course color;
- parent-course marker;
- semester and cumulative totals;
- elective groups;
- published and proposed plan totals;
- diagnostics.

Generated resolved output is never hand-edited.
