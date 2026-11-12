# Justice Institute British Columbia badge — vector reconstruction

## Main files

- **JIBC_Badge_Rebuilt.svg:** the editable vector master. All visible lettering is outlined; no fonts need to be installed. The exterior of the badge is transparent and the interior field is white.
- **JIBC_Badge_Rebuilt.pdf:** a vector PDF exported from the master SVG.
- **JIBC_Badge_Rebuilt.png:** a 3,000-pixel-wide transparent PNG preview.
- **JIBC_Monogram.svg:** the central geometric symbol on its own, with transparent counters and background.
- **JIBC_Badge_Comparison.png:** the supplied image, the rebuilt artwork, and a registered colour overlay.
- **construction.json / rebuild_vector.py:** editable construction data and a Python 3 script that can regenerate the master SVG without fonts, raster input, or network access.

## How this was rebuilt

The outer blue boundary and inner white boundary each use 11 broad cubic Bézier curves. They reconstruct the crown, shoulders, sloping lower sides and rounded lower point while retaining the reference image's proportions and slight asymmetry.

The central monogram was built as four individual vector paths. The large angular elements use straight edges, and the B and C use deliberately constructed curves. The B openings are real compound-path counters, not white shapes laid over a solid letter.

For the lettering, several installed serif typefaces were compared against representative letters. URW Bookman Demi was the strongest starting reference. Eleven letter masters — J, C, a, c, e, h, i, m, n, s and t — then received manual structural corrections to the terminals, shoulders, serifs, apertures, counters or stroke proportions. Each occurrence was individually positioned and scaled to match the reference. The five i-dots were reconstructed as separate circles. A small spacing correction keeps the first t and following i in “Institute” separate.

This is a reconstruction of the supplied image. The original typeface has not been conclusively identified, and this is not presented as the institution's original vector master.

## Editing and colour

The SVG has four named layers: badge outline and white field, central monogram, upper lettering, and lower lettering. Every letter is individually selectable, with its original character retained in the group label. Letter outlines can be edited with the node/point tools in a vector editor; they are not live text.

The artwork uses one flat blue, **#0141A2**, sampled from the source's central blue areas, plus **#FFFFFF**. This is an image-based colour approximation, not a verified institutional print specification. The raster's texture and small irregularities have been cleaned into flat fills and smooth curves.

## Verification

The SVG was rendered and compared with the supplied image, including an enlarged check at 3× the original size. The complete blue artwork has 41 separate connected pieces: one border, four central monogram parts, 31 letters and five i-dots. Letter gaps and counters were checked after the reconstruction. The master SVG contains 37 path objects and five circles, with no embedded raster images and no live text. The PDF contains vector drawing objects with no embedded raster images.

The comparison overlay uses dark ink for shared filled areas, cyan for source-only areas, and magenta for reconstruction-only areas. Thin coloured fringes make small outline differences visible; the smooth geometric reconstruction intentionally does not reproduce raster noise or the slight bow in the source's long monogram diagonal.

## Rebuilding

Keep `construction.json` beside `rebuild_vector.py`, then run:

```sh
python rebuild_vector.py
```

This overwrites `JIBC_Badge_Rebuilt.svg` with the same authored geometry. The SVG is the primary scalable deliverable; the PDF and PNG are exports.
