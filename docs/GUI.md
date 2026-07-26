# GUI

Run `npm run gui` and open `http://127.0.0.1:4174`.

## Workflow

1. Create/select an institution.
2. Create/select a college.
3. Create/select a major.
4. Select applicable shared semester sources.
5. Add major-owned semesters and course codes.
6. Enter plan-owned prerequisites, corequisites, minimum hours, text conditions, and track status.
7. Add scoped shared or custom electives.
8. Enable and arrange the proposal.
9. Review diagnostics.
10. Save and export.

Institution/college names and edition/release are not editable per plan. Institution settings own shared release metadata.

## Shared sources

The settings tab can create, edit, duplicate, and delete unused shared semester/elective sources. Scope can target the institution, one college, or selected major IDs. A major only sees sources applicable to its current context. Usage reporting blocks deletion while referenced.

## Course lookup and fallback

Search results expose catalog provenance separately from data-quality badges. Missing courses immediately expose name and numeric fact fields. Numeric zero is retained. Saving hydrates catalog facts into the owning fallback map. “تحديث البيانات من الدليل” is explicit and does not silently overwrite manual work.

## Requirements and markers

The editor exposes previous requirements, concurrent requirements, text conditions, minimum completed credits, and track status. Preview uses the resolved rule label:

- prerequisite codes render in the requirement pill;
- corequisites render with `مرافق`;
- minimum credits render with `إتمام … ساعة`;
- the red dot is independent and means the course is required by a later published course.

## Proposal

Real courses are draggable and movable across regular/summer proposal semesters. Placement stores stable occurrence IDs. Reset returns real courses to published levels while preserving source-level placeholders; synchronize preserves valid moves and incorporates parent changes.

## Preview fidelity

The server exposes ignored local IBM Plex Sans Arabic weights only on localhost. CSS loads those files, preview pages embed returned SVG inline, and rendering waits for `document.fonts.ready`. This matches the font files used by deterministic fontkit measurement/export and supports multi-page zoom.

Blocking errors disable export. Clicking a diagnostic scrolls to its editor location.
