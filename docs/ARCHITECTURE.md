# Architecture

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
