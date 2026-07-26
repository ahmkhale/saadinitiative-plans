The result is strong, but there is one important architectural mistake: Codex treated `594 × 1045` as the page contract. Your actual contract is:

```text
width = always 594 pt
height = derived independently for each page from its content
```

Also, a 6–10% component difference is still large enough that we should not accept “mostly font rasterization” without another measured pass.

Send Codex this next:

````text
Continue the Saad Plan Generator work, but correct the workflow and architecture before adding the GUI.

## Git workflow

Do not create branches or pull requests for this repository from now on.

First integrate the existing visual-parity commit into `main`:

- Existing commit: `661ca8e`
- Existing branch: `codex/figma-visual-parity`
- Existing draft PR: #1

Prefer a clean fast-forward into `main` when possible. Otherwise cherry-pick the commit.

After confirming the commit is present on `main`:

- push `main`;
- close draft PR #1;
- delete the visual-parity branch locally and remotely;
- remain on `main`;
- make all subsequent work directly on `main`;
- create clear incremental commits and push them.

Do not create another branch or PR.

---

# Phase 1 — Correct dynamic page height

The current implementation incorrectly treats `594 × 1045 pt` as the universal page size.

The real rule is:

```text
page width = fixed at 594 pt
page height = calculated from the content of that specific page
````

The height depends on:

* number of semesters;
* number and arrangement of course rows;
* year and phase grouping;
* elective groups;
* optional summer semester;
* optional proposed plan;
* optional explanatory guide;
* footer;
* section gaps and page margins.

The `978`, `983.748779`, and `1045` heights seen in Figma or generated fixtures belong to specific compositions. None of them is a universal constant.

## Required behavior

Each generated page must calculate its height independently.

For example:

```text
published page:
top margin
+ header
+ header gap
+ semester/phase composition
+ elective composition
+ footer gap
+ footer
+ bottom margin

proposal page:
top margin
+ proposal header
+ semester/phase composition
+ optional summer semester
+ optional guide
+ footer gap
+ footer
+ bottom margin
```

The footer must follow the content. It must not remain at a globally hard-coded `y=961`.

The following must all use the calculated height:

* SVG `height`;
* SVG `viewBox`;
* Inkscape page bounds;
* PDF page dimensions;
* PNG render dimensions;
* multipage SVG page definitions.

A two-page document may legitimately contain two pages with the same width but different heights.

Do not scale or compress components to fit a fixed page height.

Keep the Figma component dimensions fixed and expand the page vertically.

## Tests for dynamic height

Add tests proving that:

* width is always exactly `594`;
* a six-semester plan is shorter than an eight-semester plan;
* adding an elective group increases the page height;
* adding a second elective row increases the height;
* adding a summer semester increases proposal-page height;
* adding the guide increases proposal-page height;
* published and proposal pages can have different heights;
* the footer is always below the final content section;
* no rendered section exceeds the calculated page bounds;
* identical input produces identical dimensions.

Update documentation and remove statements that describe `594 × 1045` as the universal page size.

---

# Phase 2 — Continue the visual-parity pass

The first pass improved the whole-page difference, but the work is not finished.

Current reported differences:

* published page: 6.82%;
* proposal/guide: 7.17%;
* header: 7.53%;
* semester: 6.58%;
* course card: 6.05%;
* electives: 5.90%;
* footer: 4.34%;
* guide: 9.79%.

Do not automatically attribute these differences to font rasterization.

Determine which differences are caused by:

* incorrect geometry;
* wrong page composition;
* incorrect font family or weight;
* baseline placement;
* line height;
* text measurement;
* missing clipping;
* incorrect opacity;
* stroke alignment;
* wrong layer order;
* Figma versus Inkscape rasterization.

Only classify something as an unavoidable renderer difference after proving that the vector geometry and text bounds agree.

## Focus areas

Continue inspecting the real Figma nodes and improve:

* header composition and typography;
* title and badge alignment;
* semester summaries;
* course-card internal geometry;
* course-name and code baselines;
* prerequisite labels;
* year and phase rails;
* elective group headers and row spacing;
* proposal page;
* summer row;
* explanatory guide;
* connector lines;
* footer.

The guide currently has the highest reported difference and needs a dedicated pass.

Use close-up comparisons in addition to whole-page comparisons.

Do not hard-code the contents or coordinates of one particular major. Extract reusable layout rules.

## Generalization check

Generate and inspect at least two materially different plans:

1. the current reference plan;
2. another plan with a different number of courses, semesters, and elective groups.

Both plans must use the same shared renderer without special-case coordinates.

---

# Phase 3 — Build the local Plan Generator GUI

After correcting dynamic height and completing the next visual pass, build a local Arabic RTL GUI modeled on the Saad Calendar Generator.

Inspect the calendar-generator repository and reuse its successful architecture where appropriate:

* local GUI server;
* atomic JSON persistence;
* live preview;
* unsaved edits reflected immediately;
* PDF as the default output;
* SVG retained only when explicitly requested;
* rendering complexity hidden from the operator.

Do not copy calendar-specific logic. Reuse the workflow and repository patterns.

## Product goal

The operator should only provide plan decisions.

The operator adds:

* colleges;
* majors;
* semesters;
* elective groups;
* course codes.

The generator derives everything else from `courses.json`.

The normal GUI workflow must not require manually entering:

* course names;
* academic hours;
* lecture hours;
* practical hours;
* exercise hours;
* prerequisites;
* corequisites;
* minimum completed hours;
* colors;
* parent-course markers;
* semester totals;
* cumulative totals;
* total plan hours;
* year rails;
* phase rails;
* card coordinates;
* page height.

The core principle remains:

```text
Store choices. Derive facts.
```

---

# GUI information architecture

Create a local Arabic RTL interface with the following major areas.

## 1. Colleges

The operator can:

* view all colleges;
* add a college;
* edit its display name and stable ID;
* delete a college only after confirmation;
* see the majors belonging to it.

Store college and plan files under a clear structure such as:

```text
colleges/<college-id>/<major-id>/plan.json
```

Do not store renderer coordinates in these files.

## 2. Majors

The operator can add or edit:

* major name;
* stable ID;
* university;
* college;
* degree;
* edition;
* release;
* expected total credits;
* optional metadata currently supported by the plan schema.

Creating a major should create a valid initial `plan.json`.

The GUI should allow opening, duplicating, renaming, and deleting a major.

## 3. Semesters

The operator can:

* add a semester;
* delete a semester;
* reorder semesters;
* edit its displayed name;
* optionally assign a phase;
* optionally assign or derive a year;
* add and reorder courses.

The main course input must accept only course codes.

Support:

* searchable course-code autocomplete;
* entering one code at a time;
* pasting multiple codes separated by lines, commas, or spaces where unambiguous;
* drag-and-drop or button-based course reordering;
* duplicate detection;
* immediate resolution feedback.

A course row should display derived information after resolving the code:

* normalized course code;
* Arabic name;
* academic hours;
* lecture/practical/exercise hours;
* prerequisites;
* corequisites;
* minimum completed hours;
* color;
* warning state.

These facts are displayed for review but are not repeatedly written into the semester entry.

## 4. Elective groups

The operator can:

* add an elective group;
* edit its name;
* set required hours;
* add only course codes;
* reorder courses;
* reorder groups;
* delete a group.

The generator calculates:

* course facts;
* included hours;
* required-hours label;
* parent-course relationships;
* layout height;
* number of rows.

No card coordinates should be stored.

## 5. Proposed plan

Support the existing optional `proposal` model in the GUI.

The operator can:

* enable or disable a proposed-plan page;
* manage its semesters;
* add a summer semester;
* manage phases;
* add normal course codes;
* add special placeholder courses where necessary;
* enable or disable the explanatory guide.

Normal courses still resolve entirely from `courses.json`.

Placeholder editing should be clearly separated from normal course entry.

## 6. Course catalog status

Treat `courses.json` as the normal source of course facts.

Show:

* loaded catalog path;
* number of catalog courses;
* last loaded or modified time where available;
* unresolved course count;
* conflicting definitions;
* missing colors or details.

Do not provide a normal workflow for editing catalog facts inside every plan.

---

# Resolution and fallback behavior

Preserve this precedence:

```text
explicit per-plan override
→ courses.json
→ fallbackCourses
→ unresolved-course error
```

## Normal case

The plan stores only:

```json
"101 عال"
```

or the equivalent normalized course reference.

## Missing course workflow

When a code does not exist in `courses.json`:

* show a clear unresolved state;
* do not invent information;
* allow the operator to create a `fallbackCourses` definition through a focused dialog;
* require the minimum necessary facts;
* show that this is an exceptional fallback, not the normal workflow.

## Overrides

Per-plan overrides must exist, but place them under a collapsed advanced section.

The operator should not accidentally duplicate catalog data.

Clearly label overridden fields.

Provide a reset-to-catalog action.

---

# Automatic derivation

The GUI preview and exporter must automatically derive:

* names;
* all hour types;
* prerequisites;
* corequisites;
* minimum completed-credit requirements;
* parent-course status;
* track status;
* extinct status;
* course colors;
* semester totals;
* cumulative totals;
* plan total;
* year grouping;
* phase grouping;
* elective calculations;
* warnings;
* card layout;
* section layout;
* page height.

A data change should recompute these values immediately.

Do not make the operator click a separate “recalculate” button.

---

# Live preview

Create a full-plan visual preview comparable to the calendar generator.

The preview must:

* render unsaved changes;
* use the same shared renderer as final export;
* update after college, major, semester, elective, course, color, or proposal changes;
* preserve Arabic RTL rendering;
* show the complete dynamically sized page;
* support page 1 and optional page 2;
* allow zooming or fitting the page;
* display current diagnostics.

Do not create a separate approximate HTML design that can drift from the PDF renderer.

Prefer serving the actual generated SVG preview or a renderer output derived from the same functions.

Use debouncing where needed, but preserve responsive editing.

---

# Validation experience

Add a diagnostics panel categorized into:

* errors;
* warnings;
* information.

Examples:

* unresolved course;
* duplicate course;
* duplicate normalized code;
* prerequisite cycle;
* prerequisite after dependent course;
* missing prerequisite from plan;
* semester-hour mismatch;
* total-hour mismatch;
* long course-name overflow;
* semester card overflow;
* missing color;
* invalid fallback;
* conflicting override.

Clicking a diagnostic should focus or highlight the relevant semester, elective group, or course.

Disable final PDF export when blocking errors exist.

Warnings should not necessarily block export.

---

# Persistence

Use atomic file writes like the calendar generator.

Requirements:

* load existing `plan.json`;
* preserve schema compatibility;
* validate before writing;
* write through a temporary file and atomic rename;
* avoid partial/corrupt files;
* keep unsaved state separate from persisted state;
* warn before leaving with unsaved changes;
* expose save status;
* avoid writing derived facts unnecessarily.

The canonical persisted source remains `plan.json`, not GUI-specific state.

Do not introduce a database or authentication system for this local GUI.

---

# Export workflow

The primary action is:

```text
Save and generate PDF
```

Also provide:

* generate PDF without saving, when useful;
* keep SVG checkbox;
* PNG preview/export option for debugging;
* open output directory;
* clear success and error messages.

PDF remains the default persistent artifact.

Do not retain temporary SVG files unless requested.

---

# Suggested module boundaries

Follow the calendar generator’s separation of concerns.

A suitable structure may include:

```text
gui/
  index.html
  app.js
  styles.css

src/
  gui-server.mjs
  store.mjs
  preview.mjs
  render-layout.mjs
  render-svg.mjs
  exporter.mjs
  resolve.mjs
  plan-input.mjs
```

Adapt this to the existing repository rather than forcing unnecessary files.

Keep:

* storage;
* resolution;
* validation;
* layout;
* SVG rendering;
* exporting;
* GUI server

as distinct responsibilities.

Do not place all GUI API logic in one large file.

---

# API behavior

A local GUI API should support operations such as:

* list colleges;
* list majors;
* read a plan;
* validate unsaved plan data;
* preview unsaved plan data;
* save a plan;
* generate outputs;
* read catalog summary;
* resolve a course code;
* create/delete/rename plans safely.

Use well-defined JSON request and response shapes.

Prevent path traversal and reject unsafe IDs or paths.

The server must bind to localhost by default.

---

# UX expectations

The GUI should feel simple despite the complex renderer.

The ordinary workflow should be:

1. Add or open a major.
2. Add semesters.
3. Enter course codes.
4. Add elective groups and course codes.
5. Review automatically derived details and diagnostics.
6. See the plan update live.
7. Save.
8. Export PDF.

Do not expose coordinates, SVG, masks, renderer constants, or Figma measurements in the normal interface.

Use Arabic labels and RTL layout.

Use clear empty states.

Keep advanced fallback and override controls out of the main path.

---

# Tests

Add automated coverage for:

## Storage

* create/read/update/delete plan;
* atomic writes;
* invalid schema rejection;
* safe path handling;
* duplicate major ID handling.

## GUI API

* list plans;
* read plan;
* validate unsaved plan;
* preview unsaved plan;
* save valid plan;
* reject invalid plan;
* generate PDF;
* unresolved-course response.

## Derivation

* entering only a code resolves all facts;
* prerequisites, corequisites, and minimum hours appear automatically;
* parent status updates when dependencies change;
* totals update after moving courses;
* elective required hours update;
* deleting a course updates totals and parent markers.

## Dynamic layout

* page height changes immediately when semesters or electives are added;
* preview and PDF report the same dimensions;
* page 1 and page 2 can have different heights;
* footer follows content.

## Regression

* existing CLI generation still works;
* existing JSON formats still work;
* all existing tests remain enabled;
* the GUI does not mutate `courses.json`;
* final PDF and CLI output remain deterministic.

---

# Documentation

Update the professional README with:

* GUI quick start;
* GUI workflow;
* repository structure;
* storage location;
* PDF/SVG output policy;
* dynamic-height rule;
* catalog/fallback precedence;
* quality checks.

Add or update:

* `AGENTS.md`;
* `CONTEXT.md`;
* `docs/ARCHITECTURE.md`;
* `docs/DATA_MODEL.md`;
* `docs/GUI.md`;
* `docs/FIGMA_MEASUREMENTS.md`;
* `docs/KNOWN_LIMITATIONS.md`.

State clearly:

```text
Width is fixed at 594 pt.
Height is derived from each page’s content.
```

---

# Validation and delivery

Run at minimum:

```bash
npm test
npm run validate
npm run gui
```

Generate at least two different plans through:

* CLI;
* GUI.

Verify:

* PDF dimensions;
* dynamic height;
* SVG validity;
* no ID collisions;
* PNG rendering;
* diagnostics;
* atomic saves;
* catalog resolution;
* live unsaved preview.

Use the GUI manually and document the tested workflow.

Commit directly to `main` in logical increments, for example:

1. dynamic page-height correction;
2. second visual-parity refinement;
3. GUI storage and API;
4. GUI interface and live preview;
5. tests and documentation.

Push each completed commit to `main`.

Do not create a branch or PR.

---

# Final report

At completion, report:

* commits pushed to `main`;
* dynamic-height implementation;
* visual-difference improvements;
* remaining verified rendering differences;
* GUI capabilities;
* screenshots of the GUI;
* plans generated through the GUI;
* test results;
* generated output paths;
* documentation changes;
* any genuine remaining limitation.

Do not claim that a difference is caused by font rendering unless it was measured and verified.

```

This gives Codex the correct next direction: **shared visual refinement + content-derived page height + a calendar-generator-style local GUI where you enter only plan structure and course codes.**
```
