# BC Parks semicircles, constructed

The four BC Parks semicircle patches, and three gold-edged arches from the S56 collector board
that share their shape, rebuilt as exact geometry by `compose.mjs` instead of the atlas's
freehand curves:

| Patch | Upper | Lower |
|---|---|---|
| S29-O01 Parks Branch, beige | BRITISH COLUMBIA on an arc | PARKS BRANCH |
| S29-O02 Parks Branch, yellow | BRITISH COLUMBIA on an arc | PARKS BRANCH |
| S29-O04 Parks Branch, dark | BRITISH COLUMBIA on an arc | PARKS BRANCH |
| S30-O02 BC Parks flag | PofBC's flag badge (`../bc-parks-flag-badge/source/`) | |
| S56-O33 B.C.G.S. Alouette River Unit | ALOUETTE RIVER on an arc | UNIT over B.C.G.S. |
| S56-O34 B.C.G.S. Camps | B.C.G.S. on an arc | CAMPS |
| S56-O37 BC Ferries | BRITISH COLUMBIA on an arc | FERRIES |

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

**The gold-edged arches** take the same edge, field and clearances (border 3), in the atlas's
dark field and gold. The atlas drew each one flatter than a semicircle, a different freehand curve
each time, so its arc wording spans the turn it gave the first and last letters rather than their
position. Three changes follow the collector-board photograph: S56-O34's B.C.G.S. is set 1.4 times
larger over about ±42° (the atlas bunched it at the top); S56-O37's BRITISH COLUMBIA is set
1.25 times larger over about ±62°; and S56-O37's lower line reads FERRIES, not the atlas's
SHERIFFS, set from the atlas's own SHERIFFS outlines (every letter of FERRIES is in it) with the
same spacing. S56-O33's UNIT sits above B.C.G.S. at the atlas's line spacing.

The letter outlines, their sizes and the colours are the atlas reconstruction's (each Parks Branch
edition has its own face), so only the construction changes. Previews are the composed SVGs
rendered in Chromium, cropped and scaled to 440 px.

```bash
node library/supplied/bc-parks-semicircles/compose.mjs
npm run library:import
```
