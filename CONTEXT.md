# Product context

Academic plans were previously assembled manually in Figma. This repository preserves that approved visual system while making plans scalable across institutions, colleges, majors, shared academic blocks, and catalog terms.

The operator manages institutional hierarchy, each major’s inherited parent plan, track-owned additions, course codes, prerequisites/corequisites, minimum-hour/text conditions, elective decisions, proposal placement, and genuinely missing facts. The application composes parent/child plans and derives track-specific markers and everything repetitive.

## Shared academic sources

`institutions/ksu/shared-semester-sources/` contains reusable semester blocks such as `التحضيري العلمي` and common Engineering levels. `institutions/ksu/shared-elective-sources/` contains independent elective candidates such as `متطلبات الجامعة`. Every source declares institution, college, or selected-major scope.

Majors store references; they do not copy shared data. Composition occurs before semester labels, cumulative totals, elective exclusion, parent-marker derivation, and proposal reconciliation.

## Catalog durability

`catalogs/<institution>/<term>/` contains Male and Female snapshots, while `active.json` selects the lookup term. A plan remains reproducible after term rotation because a catalog-backed course hydrates a factual snapshot into its owning file. Manual fields remain authoritative until an explicit refresh.

## Requirement semantics

Requirements belong to course occurrences. The dependent course gets the visible pill. A red marker belongs to a course only when a later published course lists it as a prerequisite. Elective candidates, same-semester conversion, corequisites, and proposal movement cannot create that marker.

## Proposal relationship

The proposed page is an overlay on the published plan. It stores stable occurrence references, semester placement, order, and placeholders. Resolved facts always come from the current published parent. Synchronization inserts new parent courses, removes deleted parent courses, preserves valid moves, and never alters the published plan.

## Rendering

Resolved academic data enters measured presentation layout, then deterministic SVG, then Inkscape PDF/PNG export. Course-card overlays are pre-composed to avoid transparency-object bloat; Ghostscript automatically compacts the PDF further when available. Course cards never resize. Semester bodies wrap cumulatively. Local IBM Plex Sans Arabic files drive both fontkit measurement and inline localhost preview.

## Current architecture pass

The renderer is split under `src/presentation/svg/`; page, semester, elective, and proposal layout are separate; academic resolution and proposal reconciliation live under `src/application/`; catalogs, repositories, font metrics, Fontconfig, and Inkscape live under `src/infrastructure/`; and GUI navigation, dialogs, editor rendering, preview, export, entity, proposal, and shared-source behavior live outside `gui/app.js`. Localhost API routing and context composition also live outside `gui-server.mjs`. Compatibility entry points remain intentionally small.

Actual browser text-width verification is available through `npm run test:browser`. It is optional because it requires local IBM Plex Sans Arabic fonts and a Chromium-compatible executable.
