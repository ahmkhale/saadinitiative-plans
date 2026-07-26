# AGENTS.md

This repository is the plan equivalent of `saad-calendar-generator`.

## Product rule

The operator authors plan decisions only. Never require repeated manual entry for facts that can be read from `courses.json` or derived.

## Visual rule

Figma and the approved Saad PDFs are the visual source of truth. Do not replace measured geometry with a merely similar responsive layout.

## Protected invariants

- Resolution precedence is override -> catalog -> fallback -> error.
- Unknown required course facts are errors; do not invent them.
- `isParentCourse` is graph-derived across semester and elective courses.
- Semester, cumulative, published-plan, and proposed-plan totals are model output, never renderer calculations.
- Published pages are exactly `594 × 1045 pt`.
- The course-card background is `74 × 43` inside the Figma component proportions.
- A proposal is an optional second page in the same PDF; placeholder cards are explicit data, not fake catalog courses.
- PDF is default; persistent SVG is opt-in.
- Do not add font binaries to the repository or release ZIP.
- Keep the renderer independent of any university or college.

## Commands

```bash
npm test
npm run validate
npm run generate -- <plan.json> --catalog <courses.json> --svg --png
npm run generate:all -- colleges --catalog <courses.json>
```
