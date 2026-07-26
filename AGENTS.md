# Agent instructions

Always think and communicate with the user in English. Arabic remains appropriate for product copy, course facts, and generated plan content.

## Protected behavior

- Work on the canonical model directly; do not add migrations, legacy adapters, or backups.
- Preserve the approved Figma geometry. Do not solve text overflow by resizing cards, pills, metric boxes, summaries, or rails.
- Institution and college metadata come from repository location.
- Edition/release come from institution settings, not plan files.
- Course facts and plan-owned requirements are separate.
- Store fallback facts once in the owning file’s `fallbackCourses`.
- Catalog lookup is active Male → active Female → owning fallback → unresolved.
- Provenance and data quality are independent.
- Normalize missing activity siblings to zero only when at least one activity field is known.
- Shared semester and elective sources require explicit institution/college/major scope.
- Published courses sort automatically by number then subject.
- Parent markers derive only from prerequisites of later published courses.
- Proposal placement references stable published occurrence IDs and never mutates the published plan.
- Every page is `594 pt` wide with independently derived height.
- Use shaped IBM Plex Sans Arabic measurement and the same local font in browser preview/export.
- Keep footer hyperlinks intact.
- Keep atomic writes.

## Validation

```powershell
npm run validate
npm run gui
npm run generate -- "institutions/ksu/colleges/engineering/majors/electrical-engineering/plan.json" --svg --png
```

Inspect SVG, high-resolution PNG, PDF page sizes, PDF URLs, and the localhost GUI. Do not claim a still-running or failed validation as complete.
