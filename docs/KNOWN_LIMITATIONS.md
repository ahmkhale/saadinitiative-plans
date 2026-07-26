# Known limitations

- Catalog activation is file-based. Changing a term currently requires updating `catalogs/<institution>/active.json`; the GUI displays the active term but does not switch it.
- Course colors remain one shared map rather than institution-specific maps.
- The SVG implementation is still concentrated in `src/render-svg.mjs`; its measured layout has moved into presentation, but further component extraction must preserve the visual regression suite.
- Font binaries are intentionally ignored. Preview/export fail or warn when required local IBM Plex Sans Arabic weights are unavailable.
- PNG export uses Inkscape’s page export behavior; multi-page output is emitted as a first image plus numbered page images.

These are current engineering boundaries, not compatibility promises. Canonical development changes should not add migrations or legacy adapters.
