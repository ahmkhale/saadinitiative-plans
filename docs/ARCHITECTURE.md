# Architecture

The generator is organized around one rule: **academic decisions are resolved before presentation, and presentation never invents academic meaning**.

## Layers

### Domain

`src/domain/` contains pure rules and value operations:

- course-code normalization and comparison;
- factual activity normalization;
- prerequisite/corequisite labels;
- published parent-course derivation;
- semester and Arabic wording rules;
- diagnostics and shared-source scope.

Domain modules do not import filesystem, HTTP, GUI, SVG, Inkscape, or exporter concerns.

### Application

`src/application/plan-pipeline.mjs` is the canonical orchestration path. It:

1. normalizes and validates input;
2. selects scoped shared sources;
3. composes inherited and major-owned semesters;
4. composes shared and custom elective groups;
5. resolves course facts and plan-owned requirements;
6. validates the published course graph;
7. reconciles the proposal child overlay;
8. sends only the resolved model to presentation.

Resolution is split into focused modules:

```text
course-resolver.mjs
resolve-semesters.mjs
resolve-electives.mjs
validate-course-graph.mjs
resolve-plan.mjs
reconcile-proposal.mjs
hydrate-fallbacks.mjs
```

Plan input is also separated:

```text
domain/plan-normalization.mjs
application/normalize-plan-input.mjs
application/plan-storage.mjs
```

`src/resolve.mjs` and `src/plan-input.mjs` remain thin compatibility facades.

CLI generation, GUI preview, GUI validation, and export all delegate to the same application pipeline.

### Infrastructure

`src/infrastructure/repositories/` owns safe paths, atomic JSON persistence, institution hierarchy, plan storage, and common JSON source CRUD.

Canonical plan paths are:

```text
institutions/<institution>/colleges/<college>/majors/<major>/plan.json
```

Term catalogs are selected through:

```text
catalogs/<institution>/active.json
catalogs/<institution>/<term>/male.json
catalogs/<institution>/<term>/female.json
```

Shared semester and elective stores use the same repository primitive while retaining separate domain semantics. Catalog aggregation and active-term lookup live under `src/infrastructure/catalog/`; Chromium PDF export, Inkscape PNG export, local-font setup, shaped font metrics, and optional Ghostscript PDF compaction live under `src/infrastructure/export/`.

### Presentation

Measured presentation is split into `tokens.mjs`, `semester-layout.mjs`, `elective-layout.mjs`, `proposal-layout.mjs`, and the public `page-layout.mjs` facade. Academic resolution does not import text measurement or SVG code; renderability warnings are added only after the academic model is resolved.

SVG components are split by visual responsibility:

```text
src/presentation/svg/
  primitives.mjs
  course-card.mjs
  header.mjs
  semester.mjs
  electives.mjs
  guide.mjs
  footer.mjs
  document.mjs
```

`document.mjs` only composes resolved content and measured layouts. `src/render-svg.mjs` is a thin compatibility facade.

The framework-free GUI is split into browser modules for state, API access, dialogs, navigation, editor rendering, preview, export, entity actions, proposal actions, shared-source editing, and course rows. `app.js` is only the browser composition root. Server transport is also split: `gui-server.mjs` wires static files and localhost HTTP, while `src/presentation/gui/api-router.mjs`, `context.mjs`, and `http.mjs` own their focused responsibilities.

`app.js` is the browser composition root: it wires modules, DOM events, preview, and status reporting instead of owning all domain behavior.

## Pipeline parity

The same plan must resolve identically through CLI and GUI:

```text
repository plan + scoped shared sources + active catalog + settings
→ canonical application pipeline
→ resolved model
→ measured layout
→ deterministic SVG
→ pre-composed SVG artwork
→ Chromium PDF / Inkscape PNG
→ optional Ghostscript PDF compaction
```

Repository metadata is passed into the pipeline and is not duplicated inside major plan files.

## Identity and proposal reconciliation

Institution, college, major, source, semester, placeholder, and course occurrence IDs are stable.

Proposal `courseOrder` stores published occurrence IDs, including inherited shared occurrences. The proposal is a child overlay: it may move and reorder real courses, but cannot create, delete, duplicate, or edit them. Reconciliation derives current facts from the published parent and preserves valid placements across parent changes.

## Visual contract

The visual contract is protected at two levels:

- vector/layout tests for exact dimensions, positions, wrapping, rails, IDs, and links;
- optional browser-rendered verification for IBM Plex Sans Arabic and actual SVG text width.

Run the optional rendered-font test with:

```powershell
npm run test:browser
```

It requires an installed Chromium-compatible browser that can run headlessly and local ignored IBM Plex Sans Arabic font files. The command reports an explicit skip when Chromium is installed but unusable in the current container. Export-side font fidelity is always covered by the real Inkscape font-metrics test.

## Development policy

There is no migration layer while the product remains pre-production. Canonical changes update current JSON, schema, tests, GUI, renderer, and documentation together. Atomic replacement remains mandatory for every mutable JSON repository.

## PDF size architecture

The Figma card uses white 50% overlays and black 90% text on fully opaque card backgrounds. The course-card renderer pre-composes those colors in sRGB, which is visually equivalent on the opaque card and avoids redundant transparency objects in PDF and PNG exports.

Chromium prints each independently sized SVG page with the same local IBM Plex Sans Arabic weights used by measurement and preview. Marked-content `/ActualText` preserves logical Unicode for shaped Arabic, including required lam–alef ligatures, while leaving the approved visible glyphs unchanged. `pdf-optimizer.mjs` can then opportunistically rewrite the browser PDF through Ghostscript `pdfwrite` with marked-content preservation enabled; it keeps vector artwork, subset fonts, dimensions, text, and URL annotations. The optimizer replaces the file only when the result is smaller and falls back safely when Ghostscript is unavailable.
