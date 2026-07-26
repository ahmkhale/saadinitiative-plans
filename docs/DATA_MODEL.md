# Data model

## `plan.json` owns plan decisions

- which courses appear and in which semester;
- published-plan placement and optional proposed-plan arrangement;
- elective groups and either their required hours or custom requirement text;
- required/elective status;
- track-specific and extinct flags;
- phase and header labels;
- truly plan-specific overrides;
- fallbacks for courses absent from the catalog;
- black placeholder cards used by proposed plans.
- references to reusable shared semester sets.
- prerequisites, corequisites, minimum completed hours, and track status.

## `courses.json` owns reusable course facts

- canonical name;
- academic and contact hours;
- prerequisites and corequisites when available;
- catalog status and category.

## Resolved output owns derived facts

- normalized code and subject;
- selected source and provenance (`male`, `female`, `manual`, `placeholder`, or
  `unresolved`);
- Figma course color;
- parent-course marker;
- semester and cumulative totals;
- elective groups;
- published and proposed plan totals;
- diagnostics.

Generated resolved output is never hand-edited.

## GUI persistence

The GUI adds no private data model. It reads and writes the same schema-compatible
`plan.json` files used by the CLI:

```text
colleges/<college-id>/<major-id>/plan.json
```

College IDs and major IDs are safe stable path segments. College display names
are stored in the college directory metadata; a major's display name and all plan
decisions remain in its `plan.json`.

Ordinary semester and elective entries persist only a normalized course code.
An object entry is used when the operator makes a first-class plan-rule decision.
Missing courses are described under `fallbackCourses` with name plus all four
hour fields; explicit zero is preserved. Proposal placeholders carry their own
facts.

Resolution order is protected:

```text
override -> Male -> Female -> fallback -> unresolved error
```

The Male catalog wins a conflicting shared code. The Female catalog contributes
codes absent from the Male catalog. Neither file is mutated by the GUI. Source
badges and `catalogSource` survive section aggregation.

Published semester and elective entries are canonicalized automatically by
course number then Arabic subject. A proposal semester stores:

```json
{
  "id": "proposal-1",
  "name": "المستوى الأول",
  "courseOrder": ["101 عسب", "101 ريض"],
  "placeholders": []
}
```

Across the proposal, `courseOrder` must equal the complete published real-course
set exactly once. It is arrangement, not a second course catalog. Placeholder
objects are explicit additions and render after real courses.

Global edition/release defaults live in `data/settings.json`. Reusable semester
sources live outside plans and are referenced by ID through
`sharedSemesterSets`; they may compose other shared sets without copying them.
