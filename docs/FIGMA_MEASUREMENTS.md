# Figma renderer measurements

The renderer geometry is measured from the `Plans` Figma file, not inferred from
generated output. The fixed values live in `src/render-layout.mjs`.

## Inspected reference nodes

| Renderer area | Figma node | Notes |
| --- | --- | --- |
| Published reference page | `122:33350` | Exact `594 × 1045` plan for the repository reference example |
| Proposal and course guide | `122:34146` | Proposal grid, summer row, guide, and footer composition |
| Current science plan page | `381:76418` | Cross-check of shared layout components |
| User-linked course instance | `381:80662` | Normal card without prerequisite |
| Prerequisite card instance | `381:80184` | Card with prerequisite pill |
| Main header component | `281:48695` / instance `308:61555` | Title, degree, edition badge, and Saad logo |
| Course component set | `1:124` | Shared card variants and marker geometry |
| Elective section | `122:33558` | Multi-row elective groups and summaries |
| Course guide component | `281:48803` | Scaled card and annotation geometry |
| Footer component | `281:48888` | Links, copyright, icons, and end-of-page bar |

## Page and section geometry

- Published page: `594 × 1045 pt`.
- Inner content frame: `x=15`, `y=24`, `w=564`.
- Header: `564 × 42`.
- Semester grid top: `y=98`.
- Semester row: `57` high with a `4` gap (`61` pitch).
- Course area: `x=28`, `w=471.757019`.
- Summary: `x=499.757019`, `w=65.242989`.
- Year rail: `x=567`, `w=12`.
- Phase rail: `x=15`, `w=10`.
- Footer: `y=961`, `h=84`; cyan end bar is `y=1039`, `h=6`.
- The proposal/guide composition is `594 × 983.748779`. It is top-aligned
  inside the required `594 × 1045` published page; its footer begins at
  `y=899.748779` and the remaining bottom area stays blank.

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
