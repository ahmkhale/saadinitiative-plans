
We are building the Saad academic-plan generator. The data pipeline already works well:

plan.json
→ resolve courses from courses.json
→ calculate hours, prerequisites, parent-course status, totals, etc.
→ render SVG/PDF

The remaining goal is strict visual parity with the approved Figma design.

The generated output must look like it was exported directly from Figma—not merely inspired by it.

## Source of truth

Use the actual Figma file as the sole visual specification:

https://www.figma.com/design/3r0vSL0tBOx2y2PKPz4FK3/Plans?node-id=67-5200

Important course-component area:

https://www.figma.com/design/3r0vSL0tBOx2y2PKPz4FK3/Plans?node-id=381-80184

Do not wait for screenshots from me.

Use the available Figma integration/MCP tools yourself to:

- inspect the target frame;
- inspect its child nodes recursively;
- inspect component sets and variants;
- retrieve dimensions and coordinates;
- inspect auto-layout properties;
- inspect fills, strokes, effects, opacity, radii, and clipping;
- inspect typography;
- inspect spacing and padding;
- inspect local styles and variables;
- inspect reusable assets and icons;
- retrieve screenshots from Figma when needed for comparison.

The Figma file is authoritative. Existing generator measurements are only provisional.

## Goal

Perform a complete visual-parity pass across the whole generated academic plan, not only the course card.

The final PDF and SVG should match the approved Figma plan as closely as technically possible in:

- geometry;
- page size;
- layout;
- spacing;
- rounding;
- typography;
- colors;
- strokes;
- badges;
- components;
- icons;
- alignment;
- hierarchy;
- clipping;
- page composition.

This is not a redesign.

Do not make subjective improvements. Reproduce the Figma design.

---

# Scope

Inspect and match every visible part of the design.

## 1. Page and canvas

Verify from Figma:

- exact page width and height;
- orientation;
- page background;
- outer margins;
- safe area;
- placement of all major sections;
- multipage layout;
- page separation;
- PDF page bounds;
- any bleed or clipping behavior.

Do not assume the current `594 × 1045` dimensions are correct without verifying them from Figma.

## 2. Main header

Match the complete header:

- Saad logo;
- logo dimensions;
- logo position;
- title;
- subtitle;
- university name;
- college name;
- major name;
- degree name;
- plan/version text;
- edition badge;
- release badge or number;
- decorative shapes;
- top spacing;
- left and right alignment;
- typography;
- line height;
- text wrapping;
- colors;
- border radii;
- badge padding;
- badge spacing.

Inspect whether the header uses frames, auto layout, groups, masks, or reusable components and reproduce the resulting geometry.

Do not use approximate logo text when the Figma design contains an asset or vector.

## 3. Semester containers

Match every semester row:

- container width and height;
- x/y position;
- outer corner radius;
- stroke color;
- stroke width;
- background;
- internal padding;
- distance between semester rows;
- placement of course cards;
- course-card gap;
- vertical alignment;
- available empty space;
- clipping;
- behavior for semesters with fewer courses;
- behavior for six courses;
- RTL ordering.

Make the layout deterministic from measured constants.

## 4. Semester summary panel

Match the semester summary component:

- cyan title area;
- title dimensions;
- title rounding;
- semester title position;
- cumulative-hours column;
- semester-hours column;
- vertical “الساعات” label;
- column widths;
- separators;
- backgrounds;
- tint colors;
- typography;
- number baselines;
- label baselines;
- border placement;
- corner radii;
- internal alignment.

Inspect the actual Figma component rather than inferring the geometry from the current generated result.

## 5. Course cards

Match the complete course-card component:

- card width and height;
- body radius;
- fill style;
- academic-hours badge;
- course code;
- course name;
- bottom hour boxes;
- prerequisite label;
- parent-course marker;
- track marker;
- extinct-course marker;
- all component variants;
- clipping and masks;
- internal padding;
- text alignment;
- typography;
- long-name handling;
- scaling in the explanatory legend.

The markers must visually belong to the card exactly as they do in Figma.

The hour boxes must use the same geometry and clipping as Figma, including any asymmetric radii.

Do not implement the academic-hours corner as a generic shape without checking the real node.

## 6. Year rails

Match the year indicators:

- exact width;
- exact height;
- placement beside semester groups;
- outline/fill;
- corner radius;
- text direction;
- rotated text;
- typography;
- spacing from semester containers;
- grouping of two semesters per year;
- handling of the final or summer semester.

Verify whether the year label is centered mathematically or optically in Figma.

## 7. Phase/stage rails

Match the vertical phase labels and their grouping:

- placement;
- width;
- height;
- fill;
- stroke;
- radius;
- text;
- rotation;
- typography;
- spacing;
- which semester rows each phase spans.

Do not derive the grouping only from current implementation assumptions when the plan JSON or Figma layout indicates otherwise.

## 8. Elective groups

Match every elective section:

- heading;
- required-hours indicator;
- explanatory text;
- enclosing panel;
- course-card rows;
- number of cards per row;
- card gaps;
- row gaps;
- padding;
- border;
- background;
- corner radius;
- group ordering;
- spacing between groups;
- section height;
- alignment with the main plan.

Handle variable group sizes without breaking the Figma layout.

## 9. Proposed plan page

Match the complete proposed-plan page:

- page header;
- title;
- semester rows;
- cumulative totals;
- placeholder cards;
- special labels;
- any difference from the published-plan page;
- summer semester;
- year/phase rails;
- spacing;
- footer;
- explanatory elements.

Do not treat page 2 as a generic copy of page 1. Inspect its actual Figma structure.

## 10. Placeholder cards

Match black or special placeholder courses such as:

- مقرر من المتطلبات العلمية;
- elective placeholders;
- track placeholders;
- other non-catalog cards.

Inspect their exact:

- fill;
- typography;
- card geometry;
- hours badge;
- marker behavior;
- title placement;
- fallback behavior.

They must not inherit visual properties that differ from their Figma variants.

## 11. Summer semester

Match the summer-semester presentation:

- placement;
- row height;
- title;
- summary;
- year/phase treatment;
- course-card alignment;
- cumulative-hour behavior;
- spacing above and below;
- surrounding borders.

## 12. Course-card explanatory guide

Match the entire guide/legend from Figma:

- enlarged sample card;
- scale;
- marker callouts;
- connector lines;
- headings;
- explanatory text;
- contact-hour explanations;
- academic-hours explanation;
- parent-course explanation;
- track-course explanation;
- extinct-course explanation;
- colors;
- line widths;
- positions;
- text wrapping;
- spacing.

The enlarged card should reuse the same course-card geometry when appropriate, but it must still match the Figma guide exactly.

Do not let improvements to the normal card break the legend card.

## 13. Badges and labels

Inspect and match all badges:

- edition/version badges;
- release badge;
- prerequisite pill;
- section labels;
- required-hours badges;
- special course markers;
- track indicators;
- any small chips elsewhere.

Match:

- horizontal and vertical padding;
- radius;
- fill;
- stroke;
- opacity;
- typography;
- baseline;
- placement;
- minimum and maximum width.

## 14. Typography

Use the same font family and weights as Figma.

Inspect:

- IBM Plex Sans Arabic family variant;
- regular/medium/semibold/bold usage;
- exact font size;
- line height;
- letter spacing;
- paragraph alignment;
- Arabic baseline;
- number baseline;
- RTL/LTR direction;
- optical centering;
- text wrapping.

Do not fake weights by mapping several Figma weights to the same SVG value unless technically unavoidable.

Review the current `text()` helper. It currently appears to simplify multiple font weights. Correct that where necessary.

Do not include or commit font files unless they are already legitimately part of the repository and intended for use. Use the project’s existing font-loading/export mechanism.

## 15. Colors and styles

Read the actual Figma styles and variables.

Match:

- Saad cyan;
- light cyan tint;
- plan borders;
- gray text;
- white;
- black;
- course colors;
- badge opacity;
- marker colors;
- track stroke;
- shadows, if any.

Do not use visually similar hex values when Figma provides the exact values.

Preserve the course-color resolution system, but ensure the rendered value matches the current Figma style for that course label.

## 16. Strokes, shadows, and effects

Inspect:

- stroke alignment;
- stroke width;
- dash patterns;
- opacity;
- drop shadows;
- inner shadows;
- blur;
- blend mode.

SVG/PDF may require an equivalent implementation, but it should reproduce the Figma appearance.

## 17. Footer and remaining visuals

Inspect the bottom of both pages and match everything visible:

- footer text;
- copyright;
- disclaimer;
- website or social information;
- logos;
- page labels;
- decorative elements;
- separators;
- spacing.

Do not leave an element out merely because it is small.

---

# Architecture and code quality

The renderer is currently centered around `src/render-svg.mjs`.

Refactor it into understandable visual components when helpful, for example:

- `renderHeader`
- `renderCourseCard`
- `renderSemesterRow`
- `renderSemesterSummary`
- `renderYearRail`
- `renderPhaseRail`
- `renderElectiveGroup`
- `renderProposalPage`
- `renderCourseGuide`
- `renderFooter`

Use named geometry constants or frozen layout objects instead of accumulating unexplained values.

For example:

```js
const COURSE_CARD_LAYOUT = Object.freeze({
  width: ...,
  height: ...,
  radius: ...,
  academicBadge: {
    x: ...,
    y: ...,
    width: ...,
    height: ...,
    radii: ...
  },
  parentMarker: {
    cx: ...,
    cy: ...,
    radius: ...
  },
  metrics: {
    x: ...,
    y: ...,
    width: ...,
    height: ...,
    gap: ...,
    radius: ...
  }
});
````

The measurements must come from Figma.

Avoid one-off offsets that only fix a single screenshot.

Keep all calculations deterministic.

Do not change unrelated data behavior.

---

# SVG correctness

Ensure:

* all clip paths and mask IDs are unique;
* IDs remain unique across multiple pages;
* IDs remain unique when the same card appears in the legend;
* IDs do not collide when two elements share coordinates;
* referenced IDs remain valid after multipage export;
* clipping behaves consistently in browsers, Inkscape, and generated PDFs;
* SVG remains parseable;
* generated PDF remains valid;
* no element unintentionally extends beyond its page.

Prefer a deterministic render-context ID allocator over coordinate-based IDs.

For example, the renderer can create a context:

```js
const renderContext = {
  nextId(prefix) {
    ...
  }
};
```

Pass that context through component renderers.

---

# Data behavior that must remain unchanged

Do not break or redesign:

* `plan.json` input;
* `courses.json` lookup;
* fallback course behavior;
* overrides;
* hour calculations;
* prerequisite resolution;
* corequisite resolution;
* parent-course derivation;
* elective calculations;
* proposal calculations;
* diagnostics;
* batch generation;
* PDF-by-default behavior;
* optional SVG/PNG flags.

This task is principally about visual rendering and layout.

Only change data code when a visual requirement exposes an actual correctness bug.

---

# Figma inspection workflow

Before editing:

1. Open the target Figma frame.
2. Inspect its top-level dimensions and children.
3. Record the node hierarchy.
4. Identify all reusable components and variants.
5. Inspect local styles and variables.
6. Inspect typography.
7. Inspect every page or major frame used in the generated output.
8. Take reference screenshots directly through the Figma integration.
9. Create a small measurement document or code comment mapping important Figma nodes to renderer components.

Do not ask me to provide screenshots.

Do not rely solely on the PNG preview of the whole frame when node metadata is available.

If a node is too large to inspect at once, inspect its children individually.

---

# Visual verification loop

Do not stop after one implementation pass.

For each major section:

1. Generate the real reference plan.
2. Render the output to a high-resolution PNG.
3. Obtain the matching Figma screenshot directly.
4. Crop both to the same physical region.
5. Normalize dimensions.
6. Create:

   * a side-by-side comparison;
   * a 50% opacity overlay;
   * a pixel-difference image.
7. Inspect the differences.
8. adjust the renderer;
9. regenerate;
10. repeat.

Perform this loop for at least:

* header;
* one complete semester row;
* semester summary;
* normal course card;
* parent course card;
* course with prerequisite;
* year rail;
* phase rail;
* elective group;
* proposed-plan row;
* summer semester;
* explanatory guide;
* footer;
* full page 1;
* full page 2.

Do not treat a low whole-page difference score as proof of parity. Small components must also be inspected at high zoom.

The goal is that remaining differences are mostly unavoidable rendering differences, such as font rasterization—not incorrect geometry.

---

# Responsive/variable-content verification

Test multiple content cases:

* short and long major names;
* short and long course names;
* one through six courses in a semester;
* courses with and without prerequisites;
* long prerequisite strings;
* parent courses;
* track courses;
* extinct courses;
* placeholders;
* elective groups with different course counts;
* plans with and without proposed pages;
* plans with and without summer semesters.

Where Figma only defines one fixed layout, preserve that fixed layout and handle overflow explicitly through diagnostics rather than silently shrinking everything.

---

# Tests

Improve renderer tests so they validate meaningful geometry.

Do not limit tests to regex checks that merely prove some SVG exists.

Add tests for:

* exact page bounds;
* major section positions;
* header bounds;
* semester-row bounds;
* semester-summary bounds;
* card dimensions;
* card radius;
* academic badge geometry;
* metric-box geometry;
* marker geometry;
* prerequisite pill geometry;
* year-rail grouping;
* phase-rail grouping;
* elective-group layout;
* proposal page count;
* summer row;
* footer placement;
* all elements remaining inside page bounds;
* all internal card elements remaining inside intended bounds;
* unique clip and mask IDs;
* multiple pages without ID collisions;
* normal and scaled course cards;
* deterministic output from identical input.

When practical, add snapshot/golden tests for SVG fragments or measured layout metadata.

Do not add fragile tests based on full SVG string ordering unless necessary.

Run the full existing test suite and do not weaken any test.

---

# Validation commands

At minimum run:

```bash
npm test
npm run validate
```

Generate the real reference plan with all applicable outputs:

```bash
npm run generate -- <reference-plan-json> --svg --png
```

Also validate:

* SVG XML parsing;
* Inkscape rendering;
* PDF generation;
* PDF page count;
* PDF page dimensions;
* PNG render dimensions;
* diagnostics output;
* multipage export.

Use the actual repository commands and paths when they differ.

---

# Repository hygiene

* Work on a focused branch.
* Keep changes scoped to visual parity and necessary renderer refactoring.
* Do not edit generated files manually.
* Do not commit temporary render directories.
* Do not commit downloaded Figma screenshots unless they belong in a deliberate visual-regression fixture directory.
* Do not commit font binaries newly obtained from the environment.
* Document any new rendering architecture.
* Update `KNOWN_LIMITATIONS.md` only for genuine remaining technical limitations.

---

# Acceptance criteria

This task is complete only when:

* both generated pages closely match their Figma counterparts;
* the header matches;
* semester rows match;
* semester summaries match;
* course cards and all variants match;
* year and phase rails match;
* elective groups match;
* proposed-plan visuals match;
* summer-semester visuals match;
* badges and labels match;
* the explanatory guide matches;
* typography and colors match;
* footer and small elements are present;
* SVG and PDF remain valid;
* all tests pass;
* visual overlays show no obvious layout or geometry mismatch;
* no existing data behavior is broken.

Do not claim “100% parity” without showing the comparisons.

---

# Final report

After completing the work, provide:

1. A summary of the visual components changed.
2. A list of Figma nodes/components inspected.
3. Important measurements extracted from Figma.
4. Before/after full-page comparisons.
5. Before/after close-ups of major components.
6. Overlay and pixel-difference results.
7. Commands and test results.
8. Generated PDF/SVG/PNG paths.
9. Any remaining differences.
10. A clear explanation of whether remaining differences come from:

    * incorrect geometry;
    * missing visuals;
    * font rendering;
    * SVG/PDF renderer behavior;
    * unsupported Figma effects.

Commit the changes and open a PR.

Include the comparison results in the PR description.

Do not ask me for screenshots. Inspect the Figma file directly and perform the complete visual-parity loop yourself.

```
```