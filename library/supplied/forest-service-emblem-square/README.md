# Forest Service evergreen emblem, cloth square

S48-O01, which the atlas called an unlabelled B.C. map and tree square, depicts the Forest Service
evergreen emblem. Its cloth border has nearly straight sides and modest rounded corners. PofBC's
related printed emblem has deeply bowed sides and remains in Internal Logos → Forests
(<https://projects.ahmadjalil.com/PofBC/?view=internal&internal=forests&internal-logo=forest-service-emblem>).

```bash
node library/supplied/forest-service-emblem-square/compose.mjs ../PofBC   # writes composed/S48-O01.svg
npm run library:import
```

## Construction and source comparison

`compose.mjs` reads `src/internal/forest-service-emblem.svg` from PofBC and retains its mainland,
three islands, evergreen crown and trunk, including their placement. It constructs the cloth border
independently as a rounded rectangle. The old bowed badge is no longer substituted for the cloth edge.

The construction retains the previous outline's extrema (x 183–1065, y 173–1059), centre (624, 616),
and nearly square `viewBox="177 167 894 898"`. Its straight edges use a 26-unit border, a 36-unit
outer corner radius and a 10-unit inner corner radius. These regularized radii and border width are
construction choices, not measured production dimensions. The camera photograph is oblique and
does not establish the patch's physical aspect ratio.

The November 8, 2026 comparison used the atlas's S48-O01 source crop, **336 × 318 pixels**, linked
from the PofBC patch review. This supports removing the substantial bowing; it does not support an
exact embroidery contour. The previous and revised SVGs preserve the same map and tree geometry.

## Remaining limitations

- Map and tree proportions, placement, and tiny coast/island details still need specimen review.
- Exact corners, merrowed-edge irregularities and physical width/height are unresolved.
- The existing atlas palette is retained: border `#315b36`, field `#e6dcb0`, map `#60a779`, tree
  `#111b12`. These are interpreted colours, not verified thread matches.
- The printed mark on a spoon handle (S24-O01) is related evidence for the emblem, not a cloth-border
  template, and is left out of the patch library.

This is a limited outline refinement of a reconstruction, not authenticated issue artwork.
