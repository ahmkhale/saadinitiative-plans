# Data model

## Canonical storage

A major plan stores operator-owned decisions and durable source snapshots:

- identity and expected total hours;
- references to reusable shared semester sets;
- major-owned semesters and self-contained course entries;
- course prerequisites, corequisites, minimum completed hours, and track status;
- elective groups, including references to shared elective sources;
- fallback facts with per-field `catalog` or `manual` provenance;
- the proposed-page semester arrangement and placeholder cards.

Semester labels, phase rails, renderer coordinates, resolved course facts, and
calculated totals are derived.

There is intentionally no migration or legacy adapter. Files must use the
current canonical shape; obsolete shapes fail validation instead of being
silently rewritten.

## Course entries and facts

Every plan-owned course is an object containing its durable fallback facts and
plan-owned rules:

```json
{
  "code": "201 عال",
  "fallbackName": "هياكل البيانات",
  "fallbackCreditHours": 3,
  "fallbackLectureHours": 3,
  "fallbackExerciseHours": 0,
  "fallbackPracticalHours": 0,
  "prerequisites": ["101 عال"],
  "corequisites": [],
  "minimumCompletedCredits": 30,
  "requirement": "required",
  "trackSpecific": true
}
```

Catalog lookup is Male, then Female for an absent code, then a plan fallback.
On save, catalog facts used by the plan are copied into the course entry's
`fallback*` fields, with optional per-field provenance, so the plan remains
reproducible if a catalog row later disappears. Operator edits are marked
`manual` and are never overwritten by ordinary saves. The explicit refresh
action replaces the inline snapshot from the current catalog.

`edition`, `release`, and `version` are not plan fields. Edition and release are
global settings in `data/settings.json`.

If any activity field is known, missing sibling activity fields normalize to
zero. If all activity fields are unknown, they stay unknown and resolution
reports the missing data.

## Shared semester sets

Reusable semester sources live at:

```text
data/shared-semester-sets/<id>.json
```

A major references them by ID:

```json
{
  "sharedSemesterSets": ["cfy-science"],
  "semesters": [
    { "id": "major-3", "courses": ["111 عال", "151 ريض"] }
  ]
}
```

The selected sets are prepended to the major-owned semesters. Stable composed
IDs preserve proposed-page placement as the source changes. Labels are derived
from the combined order.

## Shared elective sources

Reusable elective pools are separate from shared semester sets:

```text
data/shared-elective-groups/<id>.json
```

A plan references a source and stores only major-specific decisions:

```json
{
  "electiveGroups": [
    {
      "id": "university-requirements",
      "sourceId": "university-requirements"
    }
  ]
}
```

The resolver composes the source courses and fallbacks, then removes courses
already used by the published plan and subtracts their distinct academic hours
from the source requirement. The source itself remains unchanged. A referenced
source cannot be deleted.

## Proposed page

The proposal stores placement, order, semester type, and placeholders, but
never duplicates real-course facts:

```json
{
  "proposal": {
    "enabled": true,
    "showGuide": true,
    "semesters": [
      {
        "id": "proposal-regular-1",
        "sourceSemesterId": "major-3",
        "type": "regular",
        "courseOrder": ["111 عال", "151 ريض"],
        "placeholders": [
          {
            "id": "scientific-placeholder",
            "name": "من المتطلبات العلمية",
            "academicHours": 4,
            "lectureHours": 0,
            "exerciseHours": 0,
            "practicalHours": 0
          }
        ]
      },
      {
        "id": "proposal-summer-1",
        "type": "summer",
        "courseOrder": [],
        "placeholders": []
      }
    ]
  }
}
```

Every published real course appears exactly once in the proposal. Real courses
may be moved between regular and summer semesters and reordered; they cannot be
added, deleted, or edited there. Reconciliation discards stale references,
removes duplicates, and inserts newly published courses into their source
semester. Placeholders always render after real courses and use the visible code
`مقرر`.

## Resolved output

Generated resolved output owns:

- automatic Arabic semester labels and phase/year rails;
- normalized code and subject;
- source provenance and quality badges;
- course colors, parent markers, and track markers;
- semester, cumulative, and plan totals;
- composed shared semesters and shared elective pools;
- reconciled published and proposed pages;
- diagnostics.

Resolved output is generated and never hand-edited.
