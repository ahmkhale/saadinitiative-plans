# AGENTS.md

This repository is the plan equivalent of `saad-calendar-generator`.

## Product rule

The operator enters academic decisions and genuinely missing facts. The
generator derives everything repetitive.

## Protected invariants

- Section lookup is Male -> Female -> complete manual fallback.
- Provenance and data-quality badges are separate.
- Prerequisites, corequisites, minimum completed hours, and track status are
  first-class plan rules.
- Level names and numbers are automatic Arabic ordinals and are not persisted.
- Shared level sources are referenced and composed, never copied into majors.
- A two-level shared foundation occupies levels one and two; the first own level
  becomes level three.
- Published and elective courses sort by course number, then Arabic subject.
- The proposal is a child arrangement whose real-course set exactly equals the
  published real-course set.
- Proposal real courses may move and reorder, but cannot be added, deleted,
  duplicated, or edited.
- Proposal placeholders are proposal-owned, always render last, and always use
  the visible code `مقرر`.
- When any activity-hour field is known, its missing siblings normalize to zero;
  all three unknown values remain an error.
- Shared semester and shared elective sources are separate referenced domains.
- Catalog-backed courses hydrate durable owning-source fallbacks on save without
  overwriting manual values.
- Semester, cumulative, and plan totals are model output.
- Every page is exactly `594 pt` wide; height is content-derived.
- Semester course areas wrap after every six cards and grow by the measured
  formula; summaries remain exactly `57 pt` high.
- Figma geometry is protected. Do not fix UX by changing visual component sizes.
- Text fitting uses shaped IBM Plex Sans Arabic glyph advances and readable
  minimum sizes.
- Footer items are complete SVG/PDF hyperlinks.
- PDF is default; persistent SVG is opt-in.
- Do not add font binaries to the repository or generated ZIP files.
- During active development, update the canonical model directly: do not add
  migrations, legacy adapters, or timestamped backups.

## Commands

```bash
npm test
npm run validate
npm run gui
npm run generate -- <plan.json> --catalog <courses.json> --svg --png
```
