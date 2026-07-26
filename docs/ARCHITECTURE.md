# Architecture

## Rendering

`src/render-svg.mjs` renders the resolved model as measured SVG components:
header, semester rows, summaries, course cards, year and phase rails, elective
groups, proposal guide, and footer. It does not calculate plan totals.

All authoritative geometry is centralized in `src/render-layout.mjs`. A
cumulative layout pass records `y`, `rowCount`, `courseBodyHeight`,
`summaryHeight`, and `bottom` for every semester. All rails and downstream
sections consume those entries rather than an index-based pitch. See
`docs/FIGMA_MEASUREMENTS.md` for the Figma node mapping and extracted values.
Each page owns a deterministic render context that allocates unique IDs with a
page-specific prefix, so repeated cards and multipage output cannot collide.

Published and proposed pages retain a fixed `594 pt` width. `render-layout.mjs`
calculates each page height from its own semester composition, elective groups,
optional guide, footer gap, and footer. The same dimensions
drive the SVG root, viewBox, Inkscape page definitions, PDF, and PNG export.
Components are never compressed to fit a universal height.

```text
plan.json
  -> normalizePlanInput()
  -> validatePlanShape()

Male/courses.json + Female/courses.json
  -> buildCourseCatalog()
     - preserve source provenance
     - Male priority, Female fallback
     - aggregate section conflicts

plan + catalog + course-colors.json
  -> resolvePlan()
     - source precedence
     - shared settings, semester-source, and elective-source composition
     - activity-hour normalization and fallback snapshots
     - automatic Arabic level labels
     - prerequisite graph
     - parent-course derivation
     - semester/elective/proposal totals
     - proposal parent-child reconciliation and placeholders
     - diagnostics
  -> plan.resolved.json
  -> renderPlanDocumentSvg()
     - published-plan page
     - optional proposed-plan page
     - Inkscape multipage SVG pages
  -> Inkscape PDF export
  -> optional persistent SVG and per-page PNG previews
```

The split mirrors the calendar generator:

- persisted input stays small and operator-owned;
- reusable course facts are resolved before layout;
- the renderer consumes only a materialized model;
- Figma geometry and styles are centralized in one renderer;
- PDF is the product and SVG is optional;
- uncertainty is reported instead of guessed.

## Local GUI

`src/gui-server.mjs` binds to `127.0.0.1` and serves the Arabic RTL application
in `gui/`. Its API is intentionally thin:

```text
browser draft
  -> preview.mjs
     -> normalize + validate + resolve
     -> shared SVG renderer
  -> actual SVG pages + diagnostics + page dimensions

save
  -> store.mjs
     -> schema validation
     -> sibling temporary file
     -> atomic rename to colleges/<college>/<major>/plan.json

export
  -> preview.mjs
     -> same resolved document
     -> exporter.mjs
     -> PDF by default, optional SVG/PNG
```

`catalog-service.mjs` builds the Male and Female sources independently, preserving
their provenance and section-level conflicts. Lookup selects Male when both
sources contain the course, then Female, then a complete plan fallback. Section
files are lookup accelerators, not complete academic catalogs. The GUI never
writes course facts back to either source.

`settings.mjs` owns global edition/release defaults. `shared-semester-sets.mjs`
owns reusable level sources, scans plan usages before deletion, and writes
atomically. `semester-labels.mjs` labels the final composed sequence, so shared
foundations and major-specific levels always form one continuous numbering.
`shared-elective-groups.mjs` provides a separate centrally editable source
store, usage protection, reference composition, and published-course exclusion.
`fallback-hydration.mjs` refreshes catalog-derived factual snapshots while
preserving fields marked as manually edited.

The published model is the decision source. Its semester and elective entries
are automatically sorted. A proposal persists stable semester IDs, real-course
placement/order references, semester type, and placeholders, but never copied
real-course facts. `proposal-reconciliation.mjs` removes stale references,
detects duplicates, inherits new parent courses, preserves valid moves, and
appends placeholders after real courses.

Unsaved editor state remains in the browser. Preview and draft export accept that
state directly, so saving is not a prerequisite for visual feedback.
