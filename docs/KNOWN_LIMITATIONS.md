# Known limitations of v0.2.0

- The published-plan and proposed-plan templates now follow the supplied Saad/Figma reference closely, but visual regression still needs to be repeated against each distinct legacy plan family before claiming universal pixel parity.
- The page template is currently optimized for eight regular levels, with one optional summer row on the proposed page. Plans with more rows need an additional layout profile rather than automatic shrinking.
- A semester row displays up to six course cards. Larger semesters are rejected with `SEMESTER_CARD_OVERFLOW`; they need a dedicated layout profile rather than automatic shrinking.
- Course names longer than the fixed card capacity produce `COURSE_NAME_OVERFLOW` so clipping is visible in diagnostics instead of silently changing the measured typography.
- The GUI is optimized for desktop operator use. Its three-pane workflow is not
  intended as a phone editor.
- Course and semester reordering currently uses explicit arrow buttons rather
  than drag-and-drop.
- PDF and PNG output require Inkscape.
- `courses.json` section rows normally do not include prerequisite metadata. The resolver intentionally preserves the plan fallback graph in that case.
- Font files are deliberately not bundled. Exact typography depends on the IBM Plex Sans Arabic weights installed on the machine that exports the PDF.
- Page width is fixed at `594 pt`; each page height follows its own content. Existing `1045` and `983.748779` fixtures remain valid examples, not global constants.
