# Known limitations of v0.2.0

- The published-plan and proposed-plan templates now follow the supplied Saad/Figma reference closely, but visual regression still needs to be repeated against each distinct legacy plan family before claiming universal pixel parity.
- The page template is currently optimized for eight regular levels, with one optional summer row on the proposed page. Plans with more rows need an additional layout profile rather than automatic shrinking.
- A semester row displays up to six course cards. Larger semesters should be rejected or moved to a dedicated layout profile in a later release.
- The local GUI and live preview are not part of this release; operation is JSON plus CLI.
- PDF and PNG output require Inkscape.
- `courses.json` section rows normally do not include prerequisite metadata. The resolver intentionally preserves the plan fallback graph in that case.
- Font files are deliberately not bundled. Exact typography depends on the IBM Plex Sans Arabic weights installed on the machine that exports the PDF.
