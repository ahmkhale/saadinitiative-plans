# Architecture

## Rendering

`src/render-svg.mjs` renders the resolved model as measured SVG components:
header, semester rows, summaries, course cards, year and phase rails, elective
groups, proposal guide, and footer. It does not calculate plan totals.

All authoritative geometry is centralized in `src/render-layout.mjs`. See
`docs/FIGMA_MEASUREMENTS.md` for the Figma node mapping and extracted values.
Each page owns a deterministic render context that allocates unique IDs with a
page-specific prefix, so repeated cards and multipage output cannot collide.

Published and proposed pages retain the fixed `594 × 1045 pt` output contract.
The proposal guide uses the measured Figma composition inside those page bounds.

```text
plan.json
  -> normalizePlanInput()
  -> validatePlanShape()

courses.json
  -> buildCourseCatalog()

plan + catalog + course-colors.json
  -> resolvePlan()
     - source precedence
     - prerequisite graph
     - parent-course derivation
     - semester/elective/proposal totals
     - placeholders for proposed plans
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
