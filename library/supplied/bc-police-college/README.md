# British Columbia Police College — S56-O47

Manual vector reconstruction from the supplied photograph, reviewed 2026-11-14.
The lower inscription is **police college**. This corrects the previous atlas
identification as **Traffic Officers** and its filing under Highways and Motor
Vehicles. The patch retains ID `S56-O47` and stays filed under the Justice
Institute of British Columbia, which the BC Police College became part of. It
replaces an interim drawing (the atlas roundel with its captions reset in lower
case, `supplied/bc-police-college-roundel/`, now removed).

## Artwork

- `composed/S56-O47.svg`: complete patch, 500 × 500 drawing units, transparent
  outside the circular edge. The foundation, upper lettering, lower lettering,
  pale blue emblem and navy emblem have separate named groups or paths.
- `composed/bc-police-college-emblem.svg`: the two-colour centre emblem alone,
  with a transparent background.
- `preview-S56-O47.webp`: a 360 × 360 raster preview of the full vector.
- `source/geometry.json`: interpreted palette, regularized concentric rings,
  manually drawn Bézier emblem contours and arc-layout settings.
- `source/lettering.py`: custom geometric lowercase shapes used by both lines.
  It is a drawing vocabulary, not a recovered or converted historical font.

The supplied 500 × 666 reference photograph carries a third-party
`615policepatches.com` watermark and is not committed here; it is kept with the
supplied package, and its checksum is below.

The complete patch contains **33 closed filled paths**, including **28
individually placed letter instances**. It contains no raster elements, live
text, font files, external references, texture filters or automatic tracing.
The paths can be selected and recoloured in an SVG editor. The cloth appearance
continues to come from Patcher's existing renderer.

The reference supports open joints in the `b`, `p` and `a`, an integral-like
rising `s`, an oblique `e` bar and a short single-storey `g`. These features are
constructed explicitly. The centre mark keeps the navy shape's downward-open
counter and the pale blue rear shape's two upper points. Its symbolic meaning
is not assigned here.

## Reconstruction and comparison

The photo's approximate centre is `(250, 333)`. A vertical offset of `-83`
places the emblem on the square SVG canvas. The three concentric radii are
243, 225 and 143 drawing units. The outer fabric irregularities are regularized;
the geometry is not a pixel trace of embroidery.

The lettering was checked at normal scale and in a polar-unwrapped inspection
of the source ring. That comparison led to a tighter upper arc, a corrected `s`
and a shorter `g` descender. The polar view was an inspection aid, not a source
of traced contours. The final full-size reference/reconstruction comparison
also checked emblem tips, counter, overlaps and lower terminals.

| Role | Interpreted sRGB colour |
|---|---|
| Ring and front emblem | `#28316F` |
| Edge and lettering | `#DBD9C0` |
| Centre disc | `#BAC0B8` |
| Rear emblem | `#8BB9C9` |

These are visual approximations to photographed thread. Exact typeface,
calibrated colours, physical dimensions, issue date and original master artwork
are not established. The watermark crosses part of the centre; obscured joins
are reconstructed from the visible contours. This is a reference-based remake,
not authenticated historical manufacturing artwork. No ownership or licence
for the original photograph or historic mark is asserted.

Reference JPEG SHA-256:
`f3059d072f74ec53d6e75e5c0b359314843e71868abf549fba5b35c8d88bdb36`.

Final full-patch SVG SHA-256:
`6874e6b6e5ece5a487651356bf79e867f0de3c5f40b43bfa4505583b56a4c3a3`.

## Rebuild and integrate

From the Patcher repository root:

```sh
python3 library/supplied/bc-police-college/compose.py
npm run library:import
```

The vector composition uses only the Python standard library. It does not read
the photo or depend on a font. If changing the artwork, render a new 360 × 360
WebP preview before importing. The import applies the drawing through the
`S56-O47` entries under `relabel` and `replace` in `library/orgs.json`, and keeps
the atlas drawing's SHA-256 in `replaced.atlasSha256`:
`0c4dd02b2a3da99307889c79e0e178b51cd9cd421e6aed84e43673f47f576ea1`.
