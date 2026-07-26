# CONTEXT.md

Saad plans were assembled manually in Figma: copying roughly six facts per course, looking up course data, applying colors, calculating totals, marking prerequisites, sorting, and repeating the work for every major.

The calendar generator proved the right model: Figma is the visual specification, while a deterministic generator performs the repeated production work.

Version 0.2 implements the visual-parity architecture:

1. one `plan.json` per major;
2. reusable course facts from `courses.json`;
3. plan fallback only when the catalog lacks a course;
4. automatic prerequisite graph, parent-course flags, colors, hours, and totals;
5. measured Figma geometry for the header, edition badge, logo, semester rows, course cards, summaries, year/phase rails, elective groups, and footer;
6. exact `594 pt` page width with content-derived height for each PDF page;
7. an optional second proposal page with a summer row, black placeholder courses, and the illustrated card guide;
8. PDF by default, optional multipage SVG and per-page PNG previews;
9. resolved data and diagnostics beside every output.

The supplied `saad-web` code informs the PlanDefinition adapter, catalog-row adapter, and domain rules. The calendar generator informs the CLI and temporary-SVG-to-PDF workflow. The approved Figma frame and supplied two-page Saad plan are the regression reference for visual work.
