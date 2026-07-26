# Architecture

## Layers

### Domain

`src/domain/` contains pure course-code, factual normalization, requirement formatting, parent derivation, semester, diagnostics, Arabic wording, and source-scope rules. Domain modules do not import filesystem, HTTP, GUI, SVG, or exporter concerns.

### Application

`src/application/plan-pipeline.mjs` is the only full orchestration path. It normalizes and validates input, selects scoped shared sources, composes published data, resolves facts/rules, reconciles proposals, and sends the resolved plan to presentation.

Thin use-case entry points expose composition, fallback hydration, plan resolution, and proposal reconciliation. `src/pipeline.mjs` (CLI) and `src/preview.mjs` (GUI) delegate to the canonical pipeline.

### Infrastructure

`src/infrastructure/repositories/` owns safe IDs, atomic JSON writes, institution hierarchy, and plan storage. Catalog files, settings, local fonts, Inkscape export, and HTTP serving are outside-world concerns.

Institution repository paths are canonical:

```text
institutions/<institution>/colleges/<college>/majors/<major>/plan.json
```

### Presentation

`src/presentation/layout/page-layout.mjs` owns measured Figma constants and cumulative layout formulas. Presentation consumes a resolved plan; it does not decide prerequisite or parent semantics. `src/presentation/svg/document.mjs` is the presentation entry point while `src/render-svg.mjs` remains the current SVG component implementation.

The framework-free GUI separates API access, state, selectors, editor behavior, diagnostics, and inline preview.

## Pipeline parity

CLI, GUI preview, GUI validation, GUI save/export, SVG, PDF, PNG, and regression tests share the same application pipeline. Metadata is passed in from repository context and never persisted into major plans.

## Identity and reconciliation

Institution, college, major, source, semester, placeholder, and course occurrence IDs are stable. Proposal `courseOrder` contains occurrence IDs, including inherited shared occurrences. Reconciliation uses those IDs for set integrity and course codes only for academic prerequisite comparisons.

## Development policy

There is no compatibility layer. Canonical changes update current JSON, schema, tests, GUI, renderer, and docs together. Atomic replacement remains mandatory for every mutable JSON repository.
