# AGENTS.md

This repository is the plan equivalent of `saad-calendar-generator`.

## Product rule

The operator authors plan decisions only. Never require repeated manual entry for facts that can be read from `courses.json` or derived.
Section files are lookup accelerators, not complete academic catalogs. Course
lookup is Male -> Female -> manual, and provenance must remain visible and
machine-readable.

## Visual rule

Figma and the approved Saad PDFs are the visual source of truth. Do not replace measured geometry with a merely similar responsive layout.

## Protected invariants

- Resolution precedence is override -> catalog -> fallback -> error.
- Prerequisites, corequisites, minimum completed hours, and track status are
  first-class plan rules, not generic catalog overrides.
- Unknown required course facts are errors; do not invent them.
- `isParentCourse` is graph-derived across semester and elective courses.
- Semester, cumulative, published-plan, and proposed-plan totals are model output, never renderer calculations.
- Every page is exactly `594 pt` wide; its height is derived independently from its content.
- The course-card background is `74 × 43` inside the Figma component proportions.
- A proposal is an optional second page in the same PDF; placeholder cards are explicit data, not fake catalog courses.
- A proposal rearranges the exact published real-course set. Real courses cannot
  be added or deleted there; placeholders may be added and deleted explicitly.
- Published and elective course order is automatic. Proposal real-course order
  is manual, with placeholders rendered after real courses.
- Shared semester sets are referenced and composed, never copied into each plan.
- PDF is default; persistent SVG is opt-in.
- Do not add font binaries to the repository or release ZIP.
- Keep the renderer independent of any university or college.

## Commands

```bash
npm test
npm run validate
npm run gui
npm run generate -- <plan.json> --catalog <courses.json> --svg --png
npm run generate:all -- colleges --catalog <courses.json>
```
