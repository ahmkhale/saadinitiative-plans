# CONTEXT.md

Saad plans were assembled manually in Figma: copying roughly six facts per course, looking up course data, applying colors, calculating totals, marking prerequisites, sorting, and repeating the work for every major.

The calendar generator proved the right model: Figma is the visual specification, while a deterministic generator performs the repeated production work.

Version 0.2 implements the visual-parity architecture:

1. one `plan.json` per major;
2. reusable course facts from `courses.json`;
3. source-aware Male → Female → manual lookup, with plan fallback only when both
   section sources lack a course;
4. automatic prerequisite graph, parent-course flags, colors, hours, and totals;
5. measured Figma geometry for the header, edition badge, logo, semester rows, course cards, summaries, year/phase rails, elective groups, and footer;
6. exact `594 pt` page width with content-derived height for each PDF page;
7. an optional second proposal page that rearranges the exact published-course
   set, plus explicit black placeholder courses, a summer row, and the illustrated
   card guide;
8. PDF by default, optional multipage SVG and per-page PNG previews;
9. resolved data and diagnostics beside every output.

The supplied `saad-web` code informs the PlanDefinition adapter, catalog-row adapter, and domain rules. The calendar generator informs the CLI and temporary-SVG-to-PDF workflow. The approved Figma frame and supplied two-page Saad plan are the regression reference for visual work.

Version 0.2 also includes a localhost-only Arabic RTL editor. The GUI reuses the
calendar generator's successful workflow boundaries—atomic JSON persistence,
live unsaved preview, and PDF-first export—without importing calendar-specific
logic. Operators now manage colleges, majors, semesters, phases, elective
groups, course codes and their deliberate dependency decisions. Catalog facts,
graph markers, totals, geometry, and page height remain generator output.

Section files are lookup accelerators, not complete academic catalogs. Each
course retains a visible and machine-readable source: Male, Female, manual, or
incomplete/conflicting. Missing courses expand inline for complete manual facts;
zeros remain explicit. Prerequisites, corequisites, minimum completed hours, and
track status are first-class plan decisions rather than catalog overrides.

Shared edition/release settings and reusable semester sets remove repeated
operator entry. Published semester and elective courses sort automatically by
course number then Arabic subject. Proposal real-course order is manual and
constrained: every published real course must appear exactly once; placeholders
are the only additive proposal entries. Legacy proposal shapes are normalized
when opened and backed up before their first canonical save.
