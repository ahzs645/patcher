# Lettering for composed patches

Shared helpers for `compose.mjs` scripts that need to set new wording or place supplied artwork.

- `lettering.mjs` sets outlined letters the way the atlas sets its own: one `<path>` per letter in font units,
  placed with `translate(x y) rotate(a) scale(s −s) translate(−advance/2 0)` about the middle of its baseline,
  the line grouped under `<g data-caption="…">` so Patcher sews it raised. `line` sets a straight line,
  `arc` a line on a circle (over the top or under the bottom), and `along` a line on any polyline, such as a
  patch's own edge (`sampleQuadratics` and `offset` make one from Bézier curves). Sizes are cap heights in
  the drawing's units.
- `embed.mjs` fits another SVG's artwork into a box, keeping its proportions, and prefixes its ids.
- `glyphs/*.json` are the outline tables, made by `build-glyphs.mjs` (its header says how to fetch the fonts):

| Table | Font | Licence | Used for |
|---|---|---|---|
| `roboto-condensed-bold` | Roboto Condensed Bold (Fontsource 5.1.0) | SIL OFL 1.1 | The atlas's bold caption face, outline for outline |
| `heros-regular` | TeX Gyre Heros Regular (PofBC's build) | GUST Font License | The atlas's light caption face, outline for outline |
| `poppins-semibold` | Poppins SemiBold (Fontsource 5.1.0) | SIL OFL 1.1 | A geometric stand-in for lower-case lettering (S56-O47) |

The tables hold A–Z, a–z, 0–9 and a little punctuation, so new captions need no font installed.
