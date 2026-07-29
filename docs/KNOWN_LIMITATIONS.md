# Known limitations

- Catalog activation is file-based. Changing a term currently requires updating `catalogs/<institution>/active.json`; the GUI displays the active term but does not switch it.
- Course colors remain one shared map rather than institution-specific maps. The repository structure can support institution-scoped maps later without changing plan files.
- Font binaries are intentionally ignored. Preview/export require local IBM Plex Sans Arabic weights. Searchable PDF export requires Chrome, Chromium, or Edge; PNG export requires Inkscape.
- PNG export uses Inkscape’s page export behavior; multi-page output is emitted as a first image plus numbered page images.
- Maximum PDF compaction requires Ghostscript. Without it, browser export still emits a compact vector PDF with logical Arabic text, subset fonts, exact page geometry, and links.

These are current engineering boundaries, not compatibility promises. Canonical development changes should not add migrations or legacy adapters.
