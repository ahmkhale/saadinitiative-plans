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
- Preserve compact-PDF behavior: course-card translucency stays pre-composed, and Ghostscript optimization must retain fonts, dimensions, and links.
- Keep atomic writes.

## Module boundaries

- Put pure academic rules in `src/domain/`.
- Put orchestration in `src/application/`.
- Put filesystem, catalogs, and export adapters in `src/infrastructure/`.
- Put measured layout and SVG composition in `src/presentation/`.
- Keep root compatibility files such as `render-svg.mjs`, `resolve.mjs`, `plan-input.mjs`, `catalog.mjs`, `catalog-service.mjs`, `exporter.mjs`, `pipeline.mjs`, and `preview.mjs` thin facades.
- Keep GUI state transformations and views in focused modules; `gui/app.js` is only the browser composition root. Keep `gui-server.mjs` as a thin localhost transport root.

## Validation

```powershell
npm run validate
# Optional when Chromium and local fonts are available
npm run test:browser
npm run gui
npm run generate -- "institutions/ksu/colleges/engineering/majors/electrical-engineering/plan.json" --svg --png
```

Inspect SVG, high-resolution PNG, PDF page sizes, PDF URLs, PDF file size, and the localhost GUI. Do not claim a still-running or failed validation as complete.
