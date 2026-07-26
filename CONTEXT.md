# Product context

Academic plans were previously assembled manually in Figma. This repository preserves that approved visual system while making plans scalable across institutions, colleges, majors, shared academic blocks, and catalog terms.

The operator manages institutional hierarchy, major-owned semesters, course codes, prerequisites/corequisites, minimum-hour/text conditions, track flags, elective decisions, proposal placement, and genuinely missing facts. The application derives everything repetitive.

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

Resolved academic data enters measured presentation layout, then deterministic SVG, then Inkscape PDF/PNG export. Course cards never resize. Semester bodies wrap cumulatively. Local IBM Plex Sans Arabic files drive both fontkit measurement and inline localhost preview.
