# Local GUI

The local GUI is an Arabic RTL operator interface over the same resolver,
layout, SVG renderer, and exporter used by the CLI.

## Start

Install Node.js 20+ and Inkscape, then run:

```bash
npm install
npm run gui
```

Open `http://127.0.0.1:4174`. The server binds to localhost only. Set `PORT` to
use another port.

## Normal workflow

1. Add or open a college and major.
2. Select reusable shared semester sets when appropriate.
3. Add major-owned semesters and course codes.
4. Enter plan-owned prerequisites, corequisites, minimum completed hours, and
   track status.
5. Add local elective groups or select a shared elective source.
6. Enable the proposed page, move and reorder real courses as needed, add
   regular or summer semesters, and append placeholders.
7. Review the actual renderer preview and diagnostics.
8. Save and generate the PDF.

Semester names are derived. Regular proposal semesters continue the Arabic
level sequence; summer semesters are labeled separately and numbered only when
there is more than one.

## Course lookup and durable fallbacks

Course lookup follows:

```text
Male section source -> Female section source -> stored fallback
```

The section files are lookup accelerators, not complete academic catalogs.
Missing courses require name and hour facts in the editor. Zero remains
distinct from an unknown value.

Saving a plan or reusable source hydrates catalog-derived facts into its
fallback map. The UI identifies catalog snapshots and manual edits separately.
Normal saves preserve manual values. Use **تحديث البيانات من الدليل** only when
the current catalog should deliberately replace a stored snapshot.

For activity hours, entering any one of lecture, exercise, or practical hours
causes missing siblings to resolve as zero. When all three are unknown, the
course remains incomplete.

## Shared semester sets

Shared semester sets live in:

```text
data/shared-semester-sets/<id>.json
```

They use the normal course editor and may contain plan rules and hydrated
fallbacks. Majors reference the source ID instead of copying the semesters.
Editing the source updates every referencing major. A referenced source cannot
be deleted.

## Shared elective sources

Shared elective pools are managed independently at:

```text
data/shared-elective-groups/<id>.json
```

The included university requirements source is a reusable pool. The major
editor shows its original course count, courses already used by the published
plan, remaining candidates, and reduced required hours. Editing the source
changes every referencing major. Referenced sources cannot be deleted.

## Proposed page

The published plan remains authoritative for real-course identity and facts.
The proposal editor controls arrangement:

- drag courses or use the movement buttons to reorder or move them;
- add regular and summer semesters;
- restore a course to its published source semester;
- add, edit, and delete placeholder cards;
- reset the arrangement from the published plan.

The proposal always reconciles to the exact published real-course set. It
silently removes stale placement references, de-duplicates entries, and adds
newly published courses. Real courses cannot be created, deleted, or fact-edited
in the proposal. Placeholders always appear after real courses.

## Persistence

Canonical plans are atomically persisted as:

```text
colleges/<college-id>/<major-id>/plan.json
```

Writes use a temporary sibling and atomic rename. There is no legacy migration
path: invalid obsolete data is reported for manual correction.

## Preview, diagnostics, and export

- The preview is the actual SVG renderer output.
- Every page is exactly `594 pt` wide and grows vertically for its own content.
- Semester cards keep the Figma width and wrap at six courses per row without a
  course-count limit.
- Blocking errors disable PDF generation.
- `حفظ وإنشاء PDF` is the primary action.
- Draft PDF export does not require saving first.
- SVG is retained only when selected; PNG is optional for visual review.
- Footer links remain clickable in SVG and exported PDF.

## Troubleshooting

- Verify `inkscape` is on `PATH` when PDF or PNG export fails.
- Keep the local IBM Plex Sans Arabic font files available; text fitting uses
  their shaped glyph advances through Fontkit, and the repository does not
  distribute the binaries.
- Resolve all error diagnostics before export.
- A referenced shared semester or elective source cannot be deleted.
