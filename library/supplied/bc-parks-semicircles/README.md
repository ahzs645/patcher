# BC Parks semicircles, constructed

The four BC Parks semicircle patches, rebuilt as exact geometry by `compose.mjs` instead of the
atlas's freehand curves:

| Patch | Upper | Lower |
|---|---|---|
| S29-O01 Parks Branch, beige | BRITISH COLUMBIA on an arc | PARKS BRANCH |
| S29-O02 Parks Branch, yellow | BRITISH COLUMBIA on an arc | PARKS BRANCH |
| S29-O04 Parks Branch, dark | BRITISH COLUMBIA on an arc | PARKS BRANCH |
| S30-O02 BC Parks flag | PofBC's flag badge (`../bc-parks-flag-badge/source/`) | |

- **Edge:** a true semicircle, radius 48 in the atlas's master units (its patches are 96 wide).
- **Field:** the edge inset by the border width (3, or 3.5 on the flag patch) everywhere: an arc
  of radius 48 − border on the same centre, over a base raised by the border, meeting at the exact
  corners.
- **Upper wording:** on an arc concentric with both, its capitals 2.6 inside the field's arc. The
  letters are spaced by their own advance widths with even tracking, symmetric about the top, over
  the atlas's span (about ±60°).
- **Lower wording:** a straight baseline 2.6 above the field's base, centred, as wide as the atlas
  set it.
- **Flag badge:** scaled to the largest box of its proportions whose corners stay 2.6 inside the
  field, centred.

The letter outlines, their sizes and the colours are the atlas reconstruction's (each Parks Branch
edition has its own face), so only the construction changes. Previews are the composed SVGs
rendered in Chromium, cropped and scaled to 440 px.

```bash
node library/supplied/bc-parks-semicircles/compose.mjs
npm run library:import
```
