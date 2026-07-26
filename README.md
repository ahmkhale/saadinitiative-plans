# Saad Academic Plan Generator

An Arabic-first academic-plan editor and deterministic PDF generator. The operator enters academic decisions and missing facts; the system owns lookup, fallback durability, prerequisite presentation, markers, totals, proposal reconciliation, layout, diagnostics, preview, and export.

The visual contract comes from the approved [Plans Figma file](https://www.figma.com/design/3r0vSL0tBOx2y2PKPz4FK3/Plans?node-id=381-80662).

## Quick start

Requirements: Node.js 20+, Inkscape, and local IBM Plex Sans Arabic font files in ignored `font/` or `SAAD_FONT_DIR`.

```powershell
npm install
npm run validate
npm run gui
```

Open `http://127.0.0.1:4174`.

Generate one repository plan:

```powershell
npm run generate -- "institutions/ksu/colleges/engineering/majors/electrical-engineering/plan.json" --svg --png
```

Generate every institution plan:

```powershell
npm run generate:all -- institutions --svg --png
```

Output is ignored under `dist/<plan-id>/`: PDF, optional SVG/PNG, resolved JSON, and diagnostics JSON.

## Repository model

```text
institutions/
  ksu/
    institution.json
    settings.json
    colleges/
      engineering/
        college.json
        majors/
          electrical-engineering/
            plan.json
    shared-semester-sources/
    shared-elective-sources/
catalogs/
  ksu/
    active.json
    2026-1/
      male.json
      female.json
```

Plans do not repeat institution/college names or edition/release. Location resolves institution and college metadata; institution settings own release metadata.

## Canonical course model

Course occurrences have stable IDs and store plan-owned rules:

```json
{
  "id": "major:electrical-engineering:published-level-6:202-كهر",
  "code": "202 كهر",
  "prerequisites": ["201 كهر"],
  "corequisites": [],
  "minimumCompletedCredits": null,
  "prerequisiteConditions": [],
  "trackSpecific": false
}
```

The owning file stores factual durability once:

```json
{
  "fallbackCourses": {
    "202 كهر": {
      "name": "تحليل الدوائر الكهربائية",
      "academicHours": 3,
      "lectureHours": 3,
      "exerciseHours": 1,
      "practicalHours": 0,
      "source": "catalog",
      "manuallyEditedFields": []
    }
  }
}
```

No prerequisite or other plan rules belong in `fallbackCourses`.

Lookup is active-term Male → active-term Female → owning-source fallback → unresolved error. Provenance and data quality remain separate. If one activity value is known, unknown siblings normalize to numeric zero; if all three are unknown, they remain unknown and block export.

## Derived behavior

- Semester names and numbers derive from final composed order.
- Published/shared courses sort by number, then Arabic subject.
- Course cards remain `76 × 49 pt`; rows wrap after six without shrinking.
- Page width is `594 pt`; each page’s height derives independently.
- A red parent marker appears only when a published course is a prerequisite of a later published course.
- Requirement pills appear on dependent courses. Corequisites, minimum hours, and textual conditions use the same plan-owned rule model.
- Same-semester prerequisites, corequisites, elective dependencies, and proposal movement do not create parent markers.
- Proposals reference stable published course occurrence IDs. Real courses move/reorder but cannot be added, deleted, or duplicated; placeholders remain proposal-owned and last.
- Footer items preserve the approved appearance and export as four clickable links.

## Architecture

The canonical pipeline is:

```text
repository plan + scoped shared sources + active catalog + settings
→ normalize and validate
→ compose
→ resolve academic facts/rules
→ reconcile proposal
→ measured presentation layout
→ deterministic SVG
→ PDF / PNG
```

CLI generation, GUI preview, GUI validation, and export all call `src/application/plan-pipeline.mjs`.

See [architecture](./docs/ARCHITECTURE.md), [data model](./docs/DATA_MODEL.md), [GUI](./docs/GUI.md), [Figma measurements](./docs/FIGMA_MEASUREMENTS.md), and [limitations](./docs/KNOWN_LIMITATIONS.md).

## Development policy

This repository is in active development. Update the canonical schema, fixtures, tests, GUI, renderer, and docs together. Do not create migrations, legacy adapters, backup schemas, or timestamped conversion files. Atomic writes remain required.
