# Justice Institute of British Columbia — fan shield (S56-O46)

A supplied vector package (12 November 2026), used whole for S56-O46. The atlas had drawn this patch
from a 76 × 51 crop of a collector board; this package rebuilds it from a clearer image of the badge.

- `vectors/JIBC_Badge_Rebuilt.svg` — the master the library draws: a blue border and white field, the
  four-part JIBC monogram, and *Justice Institute* / *British Columbia*, each letter its own outlined
  path (37 paths and five circles for the i-dots). No raster images, no live text, no fonts.
- `vectors/JIBC_Monogram.svg` — the monogram alone, which `../jibc-bridge-roundel/compose.mjs` also
  uses for S56-O36.
- `vectors/JIBC_Badge_Rebuilt.pdf` — vector export.
- `source/` — `construction.json` and `rebuild_vector.py`, which regenerate the master SVG (Python 3,
  no fonts or network), and the package's own notes (`package-README.md`).
- `review/comparison.webp` — the supplied image, the rebuild and their registered overlay.

What it is not: an official master. The border is 11 authored Bézier curves; the lettering began from
URW Bookman Demi, with eleven letter masters corrected by hand and each letter placed one by one. The
original typeface is not identified, and the blue (#0141A2) is sampled from the image, not an
institutional colour specification.
