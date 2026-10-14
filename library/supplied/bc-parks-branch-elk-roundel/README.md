# British Columbia Parks Branch — vector reconstruction

Reconstructed from the image supplied in this conversation. This package is an editable redraw, not an authenticated original government master.

## Start here

- `vectors/BC_Parks_Branch_Master.svg`: primary editable artwork. Transparent outside the badge; the badge's white rim and mountains remain white.
- `vectors/BC_Parks_Branch_White_Background.svg`: the same artwork on a white page.
- `vectors/BC_Parks_Branch_Vector.pdf`: vector PDF on a 200 × 200 mm page, retaining the reference image's surrounding margins.
- `vectors/BC_Parks_Branch_Vector.eps`: EPS export for workflows that require PostScript artwork.
- `vectors/BC_Parks_Branch_Scene_Only.svg`: elk and landscape without the brown lettering band or outer rim.

## How the artwork is constructed

The primary SVG contains 12 named editing layers. The frame uses geometric ellipses. The mountain ridge uses deliberate vertices, and the elk, antlers, beard, legs and rocks use explicitly authored Bézier paths. Each of the 26 letters is an individually positioned outline. The narrow opening between the front legs is retained.

The SVGs contain no embedded raster images, live text, gradients or external linked resources. There is no font-installation dependency. The shapes were reconstructed and aligned to the reference, not generated with bitmap-to-path automatic tracing. The overall rings were regularized rather than preserving every small raster irregularity.

The source image has subtle shading and texture. The delivered artwork intentionally uses flat fills. The palette is sampled/approximated in sRGB; it is not an official spot-colour or CMYK specification.

## Editing

Use the SVG as the master. Its layer names separate the rim, lettering field, sky, mountains, terrain, far legs, main elk silhouette, anatomical details, rock lines, inner rule, and the two text rows. The main elk outline deliberately connects the antlers, head and body in one continuous silhouette.

The lettering is editable as vector geometry, **not as live font text**. The original typeface has not been verified. Spelling changes require replacing or drawing letter outlines and adjusting their placement. The original large spaces between BRITISH/COLUMBIA and PARKS/BRANCH were retained rather than re-centering the words on generic text arcs.

For printers or cutters, agree the final size and colour handling with the operator. Scale the artwork and strokes together. This is not a die-line, stitch file, colour-separated screen-print set, or claim of official authorization.

## Comparison files

`review/Source_vs_Vector.png` places the reference and vector rendering at the same scale.

`review/Registered_50_Percent_Overlay.png` blends the two on their original 1254 × 1254 coordinate grid. No local repositioning of individual parts was used to make this proof.

`review/Detail_Comparisons.png` shows antler/head, body/leg and lettering crops. `review/Edge_Comparison.png` shows reference edges in red and vector edges in cyan; coincident edges are dark. Differences in anti-aliasing and the deliberate removal of raster texture also appear in this proof.

The comparison is a review aid, not a numerical certification of exact matching. Remaining differences include small letter-contour details, curve rounding, stroke regularization, and the replacement of shaded colours with flat fills.

## Technical checks

All three SVGs were parsed and checked for duplicate IDs and embedded images. The PDF was checked for raster-image and font objects and rendered independently with Poppler. The primary SVG was also rendered with Inkscape. See `review/Vector_Validation.json` for the checks.

PNG files in `previews/` and `review/` are previews/proofs only; use the files in `vectors/` for editing and scaling.

## Rebuild source

`source/rebuild.py` holds the authored scene geometry and styling. `source/letter_placements.json` holds the exact letter paths and transforms. `source/glyph_constructions.json` contains the normalized letter constructions. `source/design_settings.json` records the design settings as a reference snapshot; the Python file is the controlling source for geometry and palette.

Run from any directory:

```sh
python path/to/source/rebuild.py
```

The script rebuilds the three SVGs inside the package's `vectors/` folder. With the optional `cairosvg` Python package installed, it also rebuilds the 1254 px PNG previews. It does not rebuild the PDF, EPS or review proofs. No font files are included or needed.
