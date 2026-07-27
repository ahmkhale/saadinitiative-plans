# Frozen Figma measurements

Reference: [Plans](https://www.figma.com/design/3r0vSL0tBOx2y2PKPz4FK3/Plans?node-id=381-80662).

## Page and flow

- Width: `594 pt`.
- Height: content-derived per page.
- Content top: `98 pt`.
- Section gap: `32 pt`.
- Footer gap/height: `32 / 84 pt`.

## Course card

- Envelope: `76 × 49 pt`.
- Horizontal gap: `1 pt`.
- Colored body: `(1, 6)`, `74 × 43 pt`, radius `6 pt`.
- Academic-hours corner: `13 × 13 pt`.
- Activity boxes: `8 × 6 pt`, `2 pt` gaps.
- Activity group outline: no fill, Saad-blue stroke; it does not alter the activity boxes or envelope.
- Parent marker: red, radius `4 pt`, white stroke.
- Track marker: green, radius `4 pt`, yellow stroke.
- Extinct marker: approved black/white target.
- Requirement pill: height `12 pt`, maximum width `51 pt`, radius `6 pt`.

Course names measure at `5 pt` SemiBold against approximately `68 pt`, then binary-search down to `2.75 pt`. Requirement labels measure at `4.5 pt` Bold down to `3.5 pt`. Both remain one line, never add ellipsis, never change geometry, and emit a targeted warning if the readable floor still overflows.

## Semester

- Summary width: `65.24298858642578 pt`.
- Summary height: fixed `57 pt`, top aligned.
- Course-area width: `471.75701904296875 pt`.
- Maximum cards per row: `6`.
- Row gap: `4 pt`.
- Course-area padding: `4 pt` top/bottom.

```js
rowCount = Math.max(1, Math.ceil(courseCount / 6));
courseBodyHeight =
  4
  + rowCount * 49
  + (rowCount - 1) * 4
  + 4;
```

Expected body heights: `57`, `110`, `163`, `216 pt` for 1–4 rows. The next semester starts after current body height plus `4 pt`.

RTL order places the first course rightmost, then continues left; cards 7 and 13 restart on the right of their rows.

## Rails, electives, proposal, footer

Year and phase rails use actual cumulative semester bounds. One regular semester reads `نصف سنة`; two read the year number. Summer semesters retain their approved special label.

Elective and proposal sections use the same `76 × 49 pt` card envelope and cumulative wrapping. Placeholders always follow real proposal courses.

Footer geometry and visible text remain frozen. Each complete footer item is wrapped by a transparent linked hit area.
