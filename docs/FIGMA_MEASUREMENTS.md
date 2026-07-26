# Figma renderer measurements

The renderer geometry is measured from the `Plans` Figma file, not inferred from
generated output. The fixed values live in `src/render-layout.mjs`.

## Inspected reference nodes

| Renderer area | Figma node | Notes |
| --- | --- | --- |
| Published reference page | `122:33350` | `594 × 1045` composition for the repository reference example |
| Proposal and course guide | `122:34146` | Proposal grid, ninth row, guide, and footer composition |
| Current science plan page | `381:76418` | Cross-check of shared layout components |
| User-linked course instance | `381:80662` | Normal card without prerequisite |
| Prerequisite card instance | `381:80184` | Card with prerequisite pill |
| Main header component | `281:48695` / instance `308:61555` | Title, degree, edition badge, and Saad logo |
| Course component set | `1:124` | Shared card variants and marker geometry |
| Seven-course published semester | `142:21542` | `537 × 110`; seventh card starts row two |
| Seven-course proposed semester | `142:32701` | Independent `537 × 110` proposal wrap |
| Shared preparatory block | `381:76423` | Two standard rows and shared rails |
| University elective group | `381:76685` | Multi-row candidates and fixed summary |
| Elective section | `122:33558` | Multi-row elective groups and summaries |
| Course guide component | `281:48803` | Scaled card and annotation geometry |
| Footer component | `281:48888` | Links, copyright, icons, and end-of-page bar |

## Page and section geometry

- Page width: always `594 pt`; height is content-derived.
- The inspected published reference happens to be `594 × 1045 pt`.
- Inner content frame: `x=15`, `y=24`, `w=564`.
- Header: `564 × 42`.
- Semester grid top: `y=98`.
- Semester summary: always `57` high.
- Course body height is `4 + rows × 49 + (rows - 1) × 4 + 4`, where
  `rows = max(1, ceil(courseCount / 6))`.
- Body heights are `57`, `110`, `163`, and `216` for one through four rows.
- The next semester begins `4 pt` after the previous calculated body bottom.
- Course area: `x=28`, `w=471.757019`.
- Summary: `x=499.757019`, `w=65.242989`.
- Year rail: `x=567`, `w=12`.
- Phase rail: `x=15`, `w=10`.
- Footer height: `84`; it begins `32` after the final content section.
- In the inspected published composition, content ends at `y=929`, the footer
  begins at `y=961`, and the page therefore ends at `1045`.
- The inspected proposal/guide composition is `594 × 983.748779`; its content
  ends at `y=867.748779` and its footer begins at `y=899.748779`.
- These heights describe those compositions, not universal page bounds.

## Course component geometry

The component envelope is `76 × 49`; the colored card background is
`x=1`, `y=6`, `w=74`, `h=43`, `r=6`.

- Academic-hours badge: `x=62`, `y=6`, `w=13`, `h=13`; corner radii are
  `1, 6, 1, 6` clockwise from top-left.
- Contact-hour boxes: `8 × 6`, at `x=24, 34, 44`, `y=43`, with top radii `1.5`.
- Parent marker: center `(5,10)`, radius `4`, white `0.75` stroke.
- Track marker: center `(5,45)`, radius `4`, yellow `1` stroke.
- Extinct marker: center `(71,45)`, outer radius `4`, inner radius `2`.
- Prerequisite frame: centered at `y=0`, height `12`, maximum width `51`,
  radius `6`.
- Card-to-card horizontal gap: `1`.
- A full six-card row starts at absolute `x=33.757019`.

## Elective groups

- Course panel width: `471.757019`.
- Summary width: `79.242981`.
- Panel padding: `5`.
- Horizontal card gap: `1`.
- Wrapped-row gap: `4`.
- Group gap: `16`.
- One-row group height: `59`.
- Two-row group height: `112`.
- For an eight-semester plan, the elective section starts at `y=614`.

## Typography and colors

The design uses IBM Plex Sans Arabic with real Regular (`400`), Medium (`500`),
SemiBold (`600`), and Bold (`700`) weights. SVG output retains those weights
instead of collapsing them.

- Saad cyan: `#00AEEF`.
- Saad tint: `#E6F7FD`.
- Plan border: `#B6CFE8`.
- Body black: `#000000`.
- Footer gray: `#616161`.
- Parent marker: `#FF0000`.
- Track marker: `#3BA521` with `#FFF200` stroke.

The course-color resolver remains independent from the renderer. Resolved course
colors are passed through unchanged.

## Course guide verification

The guide instance is `485.824097 × 192.748779` at `x=54.087952`. Its scaled
course card begins at relative `x=174.783875`, and the renderer uses the same
`1.956107` component scale.

The eight connector paths were verified from the Figma line transforms rather
than from screenshot pixels. Their relative endpoints are:

```text
(184.180908, 19.733398) -> (157.869350, 19.733398)
(184.180908, 88.331055) -> (157.869350, 88.331055)
(379.638123, 19.733398) -> (314.798927, 19.733398)
(440.718567, 88.331055) -> (313.859268, 88.331055)
(298.824097, 142.833984) -> (268.912047, 97.999755)
(460.452209, 142.833984) -> (280.912040, 89.999752)
(180.422119, 142.833984) -> (249.020110, 98.668155)
(64.839172, 142.833984) -> (229.286401, 98.668158)
```

All use a centered `0.939699` stroke. The academic-hours connector uses Saad
cyan; the remaining lines use the plan-border color. Text boxes use IBM Plex
Sans Arabic at `8.457287`, with `100%` line height for headings and `125%` for
descriptions. The renderer anchors the same boxes and line rhythm explicitly.
