# B.C. / Forest Service — emblem and caribou rectangle

S45-O01 combines the Forest Service evergreen emblem used by S48-O01 with the
captions **B.C.** and **FOREST SERVICE** and a right-facing animal. This package
replaces the atlas's coarse polygon map and angular animal with a source-specific
composition. It remains a reconstruction for review.

## Evidence and component reuse

- [S45 source photograph](https://drive.google.com/file/d/1LuVoONE1ytqacJXacmQgiucv-k5JjleR/view),
  represented by the unchanged 418 × 479 crop in PofBC's patch review.
- [S48 source photograph](https://drive.google.com/file/d/1bDBblhIfTPTb2v_euhvFb53evVVi_eWl/view)
  documents the related square patch, not S45's cloth frame or wording.
- `compose.mjs` reads `src/internal/forest-service-emblem.svg` from PofBC, the
  same master read by `forest-service-emblem-square/compose.mjs`. It extracts
  `mainland`, `island-north`, `island-middle`, `island-south`, `tree-trunk`, and
  `tree-crown` without redrawing their component outlines. The SVG metadata
  records the source file SHA-256 and the inspected PofBC revision.
- The **caribou** identification was provided by the user on November 14, 2026.
  The photograph is too blurred to independently establish species or a detailed
  antler structure. The visible right-facing posture, darker body and pale neck
  guide a restrained, manually constructed silhouette.

## Construction

The rectangular ground and small rounded corners belong to S45. The square
S48 border and the bowed printed-emblem border are not transplanted. Mainland,
islands and evergreen retain the canonical path/primitive geometry, with
independent placement, scaling and palette for this composition. The southern
island is fitted separately to the source's lower-left island. Red-brown borders
are added to the mainland and tree. The tree's crown and trunk are filled again
after their outline pass, so the parts have no internal outline seam.

The animal uses separate closed curves for the torso, legs, pale neck/head and
restrained antlers. It has no raster content, clipping masks, filters, live fonts
or external SVG dependencies. The original `B.C.` and `FOREST SERVICE` substitute
glyph outlines are preserved in `source/lettering.svg` and fitted separately;
their historical typeface has not been identified.

The cloth, map, outline, tree and lettering use the existing interpreted atlas
palette. The darker animal body adds `#aaa18a`; the neck and near legs reuse
the pale lettering colour. These are visual choices, not measured thread colours.

## Rebuild

From the Patcher repository, with PofBC available:

```sh
node library/supplied/forest-service-map-caribou/compose.mjs /path/to/PofBC
# Render composed/S45-O01.svg to preview-S45-O01.webp at 418 px wide.
npm run library:import -- --zip /path/to/bc-forestry-patch-atlas.zip
npm run library:verify -- --zip /path/to/bc-forestry-patch-atlas.zip
```

The composed SVG is committed so normal imports and consumers do not need a
PofBC checkout. Rebuilding this composition intentionally reads the canonical
master; re-importing cannot restore the old atlas geometry over it.

## Remaining review

A sharper, flatter specimen photograph is needed to resolve fine antlers,
limbs, glyph shapes, edge stitching and exact component contours. The available
photo does not establish production dimensions, a physical aspect ratio, a
manufacturing relationship between S45 and S48, or an issue date. Shared emblem
components do not merge their catalogue records. This correction leaves the
S48 drawing unchanged and records S45 as **needs refinement**.
