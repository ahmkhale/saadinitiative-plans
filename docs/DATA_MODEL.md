# Data model

## Institution hierarchy

- `institution.json`: stable `id`, display `name`.
- `college.json`: stable `id`, display `name`.
- `majors/<major>/plan.json`: the editable parent plan inherited by every track.
- `majors/<major>/tracks/<track>/plan.json`: a child overlay containing only that track’s additions and proposal.
- `settings.json`: edition, release, and shared presentation defaults.

Plan files do not contain university, college, edition, release, or version.

## Course occurrence

```json
{
  "id": "major:electrical-engineering:published-level-5:201-كهر",
  "code": "201 كهر",
  "prerequisites": ["106 ريض"],
  "forcedCorequisites": [],
  "prerequisiteAlternatives": [],
  "corequisites": [],
  "minimumCompletedCredits": null,
  "prerequisiteConditions": []
}
```

The same rule shape is used in shared semester sources and custom/shared elective candidates. Compact code strings are not persisted.

In the merged requirements editor, commas keep their existing meaning. Prefix a code with `#` to force it to be stored as a companion requirement (`مرافق`), even outside the same level. Join two or more codes with `^` to store one alternative prerequisite group rendered with `أو`; at least one option must exist in the published plan.

Track plans declare their identity and may contain additional semesters, electives, fallbacks, and a proposal:

```json
{ "track": { "id": "artificial-intelligence", "name": "مسار الذكاء الاصطناعي" } }
```

Parent semesters and electives are composed before the child’s additions. Parent facts remain owned once by the parent file. `trackSpecific` is derived after composition: parent courses are present in every track, while a child course is marked when its normalized code is absent from at least one sibling track. The flag is never stored.

## Factual snapshot

```json
{
  "fallbackCourses": {
    "201 كهر": {
      "name": "دوائر كهربائية",
      "academicHours": 3,
      "lectureHours": 3,
      "exerciseHours": 1,
      "practicalHours": 0,
      "source": "catalog",
      "manuallyEditedFields": []
    }
  }
}
```

Facts never contain prerequisites, corequisites, completion thresholds, textual conditions, track status, or elective requirement type.

Catalog hydration fills missing facts on save. It does not overwrite non-empty manual fields. Explicit refresh replaces factual values and resets provenance as appropriate.

## Activity fields

`lectureHours`, `exerciseHours`, and `practicalHours` distinguish zero from unknown.

- At least one known → missing siblings become `0`.
- All unknown → all remain unknown.
- `academicHours` alone does not trigger activity normalization.

## Shared-source scope

Institution:

```json
{ "type": "institution", "institutionId": "ksu" }
```

College:

```json
{ "type": "college", "institutionId": "ksu", "collegeId": "engineering" }
```

Selected majors:

```json
{ "type": "majors", "institutionId": "ksu", "majorIds": ["major-a", "major-b"] }
```

Out-of-scope sources are not composed.

## Proposal

Proposal semesters store stable source-semester references, type, occurrence order, and placeholders:

```json
{
  "id": "proposal-summer-1",
  "sourceSemesterId": null,
  "type": "summer",
  "courseOrder": [
    "major:electrical-engineering:published-level-10:999-كهر"
  ],
  "placeholders": []
}
```

Real course facts are never copied into proposal JSON.

## Derived output

The resolver derives catalog provenance/quality, facts, normalized activity zeros, labels, parent/track/extinct markers, elective exclusions, remaining hours, totals, cumulative hours, semester/year/phase bounds, proposal facts, and diagnostics.
