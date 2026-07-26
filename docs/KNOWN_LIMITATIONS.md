# Known limitations of v0.2.0

- Visual regression must still be repeated against each distinct legacy plan
  family before claiming universal pixel parity.
- Semester course areas wrap without an arbitrary row maximum. Very large plans
  can therefore produce unusually tall PDF pages.
- Automatic Arabic ordinal labels currently support up to twenty levels.
- Long course and prerequisite text is measured with fontkit using local IBM
  Plex Sans Arabic SemiBold/Bold files. It stops at a readable floor and emits a
  warning if the shaped text still cannot fit.
- The GUI is desktop-oriented and is not intended as a phone editor.
- PDF and PNG output require Inkscape.
- When at least one activity value is known, missing sibling activities
  normalize to zero. Only the all-unknown case remains an error.
- Font files are not bundled. Exact typography depends on locally installed IBM
  Plex Sans Arabic weights.
- Page width is fixed at `594 pt`; each page height follows its content.
