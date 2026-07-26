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
An object entry is used only when the operator makes an explicit per-plan
override or dependency decision. Missing catalog courses may be described under
`fallbackCourses`; proposal placeholders carry their own explicit fallback facts.

Resolution order is protected:

```text
override -> Male/Female merged catalog -> fallback -> unresolved error
```

The Male catalog wins a conflicting shared code. The Female catalog contributes
codes absent from the Male catalog. Neither file is mutated by the GUI.
