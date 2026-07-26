<div align="center">
  <img src="./assets/logo.svg" width="88" alt="Saad logo">

  <h1>Saad Plan Generator</h1>

  <p>Deterministic, Arabic-first academic-plan PDFs generated from compact plan files and a shared course catalog.</p>

  <p>
    <img src="https://img.shields.io/badge/output-PDF-ef4444?style=flat-square" alt="PDF output">
    <img src="https://img.shields.io/badge/input-JSON-f59e0b?style=flat-square" alt="JSON input">
    <img src="https://img.shields.io/badge/design-Figma%20parity-00aeef?style=flat-square" alt="Figma parity">
    <img src="https://img.shields.io/badge/license-proprietary-555?style=flat-square" alt="Proprietary license">
    <img src="https://img.shields.io/badge/Node.js-20%2B-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js 20+">
  </p>

  <p>
    <a href="#quick-start">Quick start</a>
    ·
    <a href="#plan-model">Plan model</a>
    ·
    <a href="#quality-checks">Quality checks</a>
    ·
    <a href="./AGENTS.md">Agent guide</a>
  </p>
</div>

Saad Plan Generator turns a small `plan.json` file and a reusable `courses.json` catalog into a
resolved, validated, and visually consistent academic-plan PDF. The operator should only describe
what belongs to the plan: the major, semester order, course codes, elective groups, and intentional
exceptions. Course names and offered-hour facts are looked up when available; plan-owned rules such
as prerequisites, corequisites, minimum completed hours, and track status are entered once. The
generator derives labels, totals, markers, layout, preview, and export.

The renderer targets the approved Saad Figma design. Visual parity is an active engineering
requirement: generated output must be compared against Figma before a layout change is considered
complete.

## Product principles

- **Plan files contain decisions, not renderer coordinates.** Shared offered-course facts are reused
  when available; academic-plan rules remain explicit plan decisions.
- **Section files are lookup accelerators, not complete academic catalogs.**
  Lookup is Male → Female → manual and retains provenance.
- **Uncertainty is reported, never invented.** Missing facts produce diagnostics instead of guessed values.
- **Figma is the visual source of truth.** Geometry, typography, colors, spacing, and variants must not drift.
- **PDF is the primary output.** SVG and PNG are retained only when explicitly requested.
- **Resolution and rendering stay separate.** The renderer consumes a fully materialized plan model.
- **Existing plans remain reproducible.** Identical inputs must produce deterministic output.

## How it works

```text
colleges/<college>/<major>/plan.json
                         +
courses.json + course-colors.json
                         ↓
normalize and validate input
                         ↓
resolve offered-course facts and apply plan-owned rules
                         ↓
derive parent markers, totals, electives, and diagnostics
                         ↓
render the approved Saad layout
                         ↓
PDF + resolved JSON + diagnostics
```

## Quick start

Requires Node.js 20+ and Inkscape. Install IBM Plex Sans Arabic Regular, Medium, SemiBold, and Bold
on the operating system before exporting for the closest match to Figma.

```bash
npm install
npm test
npm run generate -- \
  examples/college-of-computer-and-information-sciences/computer-science-networks-cybersecurity/plan.json \
  --catalog examples/catalog/courses.json
```

### Local Arabic GUI

Start the localhost-only editor:

```bash
npm run gui
```

Then open `http://127.0.0.1:4174`. Add colleges and majors, enter semester and
elective course codes, review the actual shared-renderer preview, then save and
generate the PDF. Plans are stored atomically under
`colleges/<college-id>/<major-id>/plan.json`.

The GUI reads `data/courses/Male/courses.json` first, uses
`data/courses/Female/courses.json` for missing codes, and requires manual facts
when both lack a course. Saving hydrates durable catalog snapshots without
overwriting manual values. It also manages shared edition/release settings,
reusable level sets such as `التحضيري العلمي`, and independent shared elective
sources such as university requirements.
Level names are automatic Arabic ordinals: the operator never types
`المستوى الأول` or a numeric alternative. Blocking diagnostics
disable export; warnings do not. See [docs/GUI.md](./docs/GUI.md) for the full
workflow and screenshots.

Keep SVG and render per-page PNG previews when reviewing visual parity:

```bash
npm run generate -- \
  examples/college-of-computer-and-information-sciences/computer-science-networks-cybersecurity/plan.json \
  --catalog examples/catalog/courses.json \
  --svg \
  --png
```

## Output

Files are grouped by plan ID:

```text
dist/<plan-id>/
├── plan.pdf
├── plan.svg                 # with --svg or --svg-only
├── plan.png                 # first page with --png
├── plan-page-2.png          # when a second page exists
├── plan.resolved.json       # fully materialized renderer input
└── plan.diagnostics.json    # errors, warnings, and resolution details
```

PDF is generated by default. Without `--svg`, the intermediate SVG is removed after export.

Every output page is exactly `594 pt` wide. Height is derived independently
from that page's semesters, elective rows, proposal placeholders, optional
guide, section gaps, and footer. Components keep their measured Figma dimensions;
the renderer expands the page instead of scaling content to a universal height.
Consequently, two pages in one PDF may have different heights.

## Plan model

The target repository layout is one plan file per major:

```text
colleges/
└── engineering/
    └── electrical-engineering/
        └── plan.json
```

A plan keeps global edition and release values in `data/settings.json`. Every
plan-owned course is stored as a self-contained object:

```json
{
  "$schema": "../../../schemas/plan.schema.json",
  "schemaVersion": 1,
  "id": "eng-electrical",
  "university": "جامعة الملك سعود",
  "college": "كلية الهندسة",
  "major": "الهندسة الكهربائية",
  "degree": "البكالوريوس",
  "expectedCredits": 132,
  "semesters": [
    {
      "courses": [
        {
          "code": "101 كهر",
          "fallbackName": "مقدمة في الهندسة الكهربائية",
          "fallbackCreditHours": 3,
          "fallbackLectureHours": 2,
          "fallbackExerciseHours": 0,
          "fallbackPracticalHours": 2,
          "prerequisites": [],
          "requirement": "required",
          "trackSpecific": false
        }
      ]
    }
  ]
}
```

The inline `fallback*` fields are a durable per-course snapshot, not a second
catalog. Saving copies currently resolved catalog facts into the course entry.
Manual values remain authoritative until the operator explicitly refreshes the
course from the catalog. If any activity field is known, missing sibling
activity fields normalize to zero; if all activity fields are unknown, they
remain unresolved.

Plan-owned rules belong on the semester or elective entry:

```json
{
  "code": "201 عال",
  "prerequisites": ["101 عال"],
  "corequisites": ["101 ريض"],
  "minimumCompletedCredits": 30,
  "trackSpecific": true
}
```

### Data precedence

Course facts are resolved in this order:

1. `override` on the course entry, for deliberate plan-specific exceptions.
2. Male section data, then Female section data for an absent code.
3. The course entry's inline `fallback*` snapshot.
4. `UNRESOLVED_COURSE`, rather than fabricated data.

Placeholder cards are valid only in `proposal.semesters[].placeholders`. They
are not accepted as published or elective course entries.

## Derived behavior

The generator automatically derives or validates:

- academic, lecture, practical, and exercise hours;
- semester totals, cumulative totals, and full-plan hours;
- course colors from the Arabic subject code;
- prerequisite, corequisite, and minimum-credit labels;
- **parent-course** markers when another course depends on the course;
- track-specific and extinct-course markers;
- same-semester prerequisite-to-corequisite conversion where allowed;
- duplicate courses and normalized-code collisions;
- prerequisite cycles and prerequisites placed after their dependent course;
- missing courses, missing colors, and conflicting definitions;
- mismatches between calculated and officially expected hours.

Diagnostics are written even when generation succeeds. By default, unresolved errors stop export;
`--allow-errors` is reserved for deliberate debugging.

## Elective groups

Elective or track requirements are declared separately from the regular semester sequence:

```json
{
  "electiveGroups": [
    {
      "id": "track-requirements",
      "name": "متطلبات المسار",
      "requirementText": "غير متطلب للتخرج",
      "courses": ["436 عال", "435 عال", "434 عال"]
    }
  ]
}
```

Each elective group uses exactly one completion mode: `requiredHours` or
`requirementText`.

Reusable elective pools live separately from shared semester sets:

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

The source owns the candidate courses and requirement. A major normally stores
only the source reference. Courses already placed in published semesters are
removed from the displayed candidates, and their distinct academic hours reduce
the remaining requirement.

## Proposed-plan page

The published plan remains page one. Add `proposal` to produce a second page in the same PDF:

```json
{
  "proposal": {
    "title": "الخطة المقترحة",
    "semesters": [
      {
        "id": "proposal-regular-1",
        "sourceSemesterId": "major-1",
        "type": "regular",
        "courseOrder": ["101 عال", "102 عال"],
        "placeholders": [
          {
            "id": "scientific-requirement",
            "name": "من المتطلبات العلمية",
            "academicHours": 4,
            "lectureHours": 0,
            "practicalHours": 0,
            "exerciseHours": 0
          }
        ]
      }
    ]
  }
}
```

The published plan remains authoritative for real-course identity and facts.
The proposal stores only their semester placement and order, plus placeholder
facts. Real courses can be reordered or moved between regular and summer
semesters, but cannot be added, deleted, or edited there. Reconciliation keeps
the proposal equal to the published real-course set when a published plan or
shared semester source changes. Every placeholder displays the fixed code `مقرر`
and renders after the real courses in its semester.

## Supported course catalogs

The preferred catalog is a detailed course list:

```json
{
  "courses": [
    {
      "code": { "display": "101 كهر" },
      "name": "مقدمة في الهندسة الكهربائية",
      "hours": 3,
      "details": {
        "lecturesHours": "2",
        "labHours": "2",
        "exercisesHours": "0"
      },
      "prerequisites": []
    }
  ]
}
```

The generator also accepts the website's section-row sources. Rows sharing a
normalized course code are combined, source provenance is retained, and
conflicting derived facts are reported. Section rows commonly omit required
facts; absence is never interpreted as zero.

## Shared settings and semester sets

`data/settings.json` provides the default edition and release for all plans.
Reusable semester sources live in the shared-semester store and are referenced
through `sharedSemesterSets`. References are composed at resolution time, so a
foundation year is edited once rather than copied into every major. Deletion is
blocked while a source is referenced.

The included `التحضيري العلمي` source follows the Figma Computer College model:
its two shared levels become `المستوى الأول` and `المستوى الثاني`, then the first
major-specific level becomes `المستوى الثالث`. Shared sources use the same full
course editor as majors, including lookup provenance, complete manual facts, and
plan-owned prerequisite/corequisite rules.

Published semester and elective course codes are sorted automatically by number
then Arabic subject. Proposal real courses retain the operator's manual order.
Year/phase rails support full-year and half-year spans.

Plan input is intentionally canonical-only. Registries and obsolete proposal
shapes are not adapted or migrated; convert them deliberately to one
`colleges/<college>/<major>/plan.json` file per major.

## Batch generation

Generate every `plan.json` below a directory:

```bash
npm run generate:all -- colleges --catalog courses.json
```

Optional batch flags include `--svg`, `--png`, `--allow-errors`, and `--output-dir`.

## CLI reference

```text
npm run generate -- <plan.json>
  --catalog <courses.json>       Shared course catalog
  --colors <course-colors.json>  Alternate color map
  --output-dir <directory>       Override the output directory
  --output-name <name>           Override the generated base filename
  --svg                          Keep the intermediate SVG
  --svg-only                     Generate SVG without PDF
  --png                          Render per-page PNG previews
  --allow-errors                 Export despite resolver errors
```

## Repository structure

```text
data/
  course-colors.json             Arabic subject-code → Figma color mapping
  settings.json                  Shared edition and release defaults
  shared-semester-sets/          Reusable level sources such as preparatory year
  shared-elective-groups/        Reusable elective candidate pools
docs/
  ARCHITECTURE.md                Pipeline and module boundaries
  DATA_MODEL.md                  Persisted and resolved data contracts
  GUI.md                         Local editor workflow and screenshots
  KNOWN_LIMITATIONS.md           Current layout and export constraints
gui/
  index.html                     Arabic RTL application shell
  app.js                         Editor state, API calls, and live preview
  styles.css                     Three-pane operator layout
schemas/
  plan.schema.json               JSON Schema for plan files
src/
  args.mjs                       CLI argument helpers
  catalog.mjs                    Supported catalog normalization
  diagnostics.mjs                Structured errors, warnings, and info
  exporter.mjs                   Inkscape PDF/PNG export
  generate.mjs                   Single-plan CLI
  generate-all.mjs               Recursive batch CLI
  gui-server.mjs                 Local static server and JSON API
  io.mjs                         File loading and output helpers
  normalize.mjs                  Arabic course-code normalization and sorting
  semester-labels.mjs            Automatic Arabic ordinal level labels
  pipeline.mjs                   End-to-end generation orchestration
  plan-input.mjs                 Canonical plan normalization and validation
  settings.mjs                   Shared edition/release persistence
  shared-semester-sets.mjs       Referenced reusable semester sources
  shared-elective-groups.mjs     Referenced reusable elective sources
  fallback-hydration.mjs         Durable catalog snapshots and refresh
  proposal-reconciliation.mjs    Parent-child proposal arrangement
  text-measure.mjs               Fontkit Arabic shaping and text fitting
  render-svg.mjs                 Protected Figma-faithful renderer
  resolve.mjs                    Course resolution, graph analysis, and totals
  store.mjs                      Atomic college and plan persistence
  preview.mjs                    Shared preview and draft-export boundary
test/                            Catalog, input, resolver, and renderer tests
```

## Quality checks

```bash
npm test          # domain, input, resolver, and renderer tests
npm run validate  # tests plus JavaScript syntax checks
npm run gui       # localhost GUI for the manual smoke workflow
```

Before merging a visual change, also generate the real reference plan with `--svg --png` and compare
the resulting pages and component crops against screenshots obtained directly from Figma.

## Agent entry points

A coding agent must read these files before changing the repository:

1. [AGENTS.md](./AGENTS.md) — implementation rules and protected behavior.
2. [CONTEXT.md](./CONTEXT.md) — product history, current state, and design decisions.
3. [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — runtime and module boundaries.
4. [docs/DATA_MODEL.md](./docs/DATA_MODEL.md) — input and resolved data contracts.
5. [docs/KNOWN_LIMITATIONS.md](./docs/KNOWN_LIMITATIONS.md) — explicit current constraints.

## Current constraints

- Automatic Arabic ordinal labels currently support up to twenty levels.
- Semester cards wrap after six courses per row with no course-count limit.
- Semester body height is `4 + rowCount*49 + (rowCount-1)*4 + 4`; the summary
  strip remains `57 pt`.
- PDF and PNG export require Inkscape.
- Text fitting uses Fontkit shaping against the local IBM Plex Sans Arabic
  SemiBold and Bold files; font binaries are not distributed by this repository.
- Pixel parity must be verified separately for each distinct legacy plan family.

See [docs/KNOWN_LIMITATIONS.md](./docs/KNOWN_LIMITATIONS.md) for the maintained list.

## Repository

This is a closed-source, proprietary Saad project. Generated academic plans are independent student
resources; each university's official academic plan and systems remain the authoritative source.
