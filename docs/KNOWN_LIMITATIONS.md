# Known limitations

- Catalog activation is file-based. Changing a term currently requires updating `catalogs/<institution>/active.json`; the GUI displays the active term but does not switch it.
- Course colors remain one shared map rather than institution-specific maps. The repository structure can support institution-scoped maps later without changing plan files.
- Font binaries are intentionally ignored. Preview/export require local IBM Plex Sans Arabic weights. Chromium verification is skipped in environments where the installed browser cannot complete a headless render; real Inkscape font rendering remains tested.
- PNG export uses Inkscape’s page export behavior; multi-page output is emitted as a first image plus numbered page images.
- Maximum PDF compaction requires Ghostscript. When it is unavailable, the renderer still pre-composes card translucency and produces a valid, much smaller Inkscape PDF, but the remaining SVG group structure is not flattened as aggressively.

These are current engineering boundaries, not compatibility promises. Canonical development changes should not add migrations or legacy adapters.
