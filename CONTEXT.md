# CONTEXT.md

Saad plans were previously assembled manually in Figma. The generator preserves
that visual system while removing repeated production work.

## Product model

The operator manages colleges, majors, major-specific levels, course codes,
plan-owned dependency rules, shared/custom electives, and genuinely missing
course facts. The generator
owns Arabic level names, source lookup, totals, markers, shared-level
composition, layout, live preview, dynamic page height, and export.

Section files are not complete academic catalogs. Lookup is Male, then Female,
then durable fallback facts. Successful catalog lookup hydrates a fallback
snapshot in the owning major or shared source. Prerequisites, corequisites,
minimum completed hours, and track status remain explicit plan decisions.

## Figma-derived shared levels

The Computer College reference contains one `تحضيري` frame with two 57-point
semester rows under `السنة التحضيرية`, followed by the specialization frame
starting at `المستوى الثالث`. This is modeled as one central shared source—not
as copied levels in every major.

`data/shared-semester-sets/cfy-science.json` contains the two Figma preparatory
levels. A major selects that source and stores only its own later levels. Editing
the source updates every referencing major.

## Shared electives

Reusable elective groups live separately under
`data/shared-elective-groups/`. A major stores only a `sourceId`. The university
requirements source removes candidates already placed in shared or major
semesters and subtracts each distinct course's hours from the base requirement.

## Proposal rule

The proposed page is a child arrangement. Its real-course set must exactly equal
the published set, while the operator may move and reorder those references
across regular and summer semesters. Facts always come from the current parent.
Black placeholders are proposal-owned, display `مقرر`, and always appear last.

## Rendering

Figma remains the visual source of truth. Page width is fixed at `594 pt`, while
height is calculated independently from each page's wrapped semester rows.
Every six cards create a row; course cards and `57 pt` summaries never resize.
PDF is the primary output; SVG and PNG are optional review artifacts. Footer
items remain visually identical while exporting as actual hyperlinks.
