# BC Parks — aligned landscape vector package

## Start here

Open **`vectors/bc-parks-scene-editable.svg`** for the close-reference scene.
Open **`vectors/bc-parks-scene-badge-aligned.svg`** to use the scene on the original badge-sized artboard.
Open **`alignment-viewer.html`** in a browser to compare the fitted scene against the supplied badge using an opacity slider.

This package covers **the inner landscape scene**: sky, mountains, snowcaps, forest, shoreline, and lake. It does **not** include vector lettering or the outer badge. The optional white frame is the frame immediately around the landscape, not the outer badge border.

## Two distinct vector reconstructions

### Close-reference fit — the main `vectors/` files

The scene opening, mountains, and snowcaps are authored curved paths. Forest and water shapes were reconstructed from the surviving flat aligned-scene preview using separated colour regions, sampling-noise smoothing, and cubic Bézier fitting. Continuous underpaintings prevent gaps between neighbouring foliage colours. The resulting artwork has **70 path elements, including the clipping path, in 11 named artwork layers**.

This is a **reference-fit vectorization**, not a recovered original SVG and not a claim that every branch was hand-drawn. The source raster is **not embedded in any artwork SVG, PDF, or EPS**. Region shapes, colours, and curves are genuinely editable. Forest regions are organized by colour and depth; not every tree is a single independent object in this version.

### Authored redraw — `vectors/authored-redraw/`

This alternative uses the path geometry from the supplied landscape vector package, with individually positioned and proportioned trees, a rebuilt scene opening, new mountains and snowcaps, adjusted colours, and remapped shoreline and lake geometry. It retains **14 independent tree groups** and **24 independent water-ripple paths**. Its branches are more stylized than the reference-fit version. This alternative is useful when construction-level tree editing matters more than a close contour match.

The authored SVG has 91 path elements including the clipping path, in nine named artwork layers. It is not simply a renamed copy of the input package.

## Main files

| File | Purpose |
| --- | --- |
| `vectors/bc-parks-scene-editable.svg` | Cropped, layered, close-reference scene; transparent outside the scene opening. |
| `vectors/bc-parks-scene-badge-aligned.svg` | Same scene on the original 1122 × 1402 artboard. |
| `vectors/bc-parks-landscape-no-sky.svg` | Scene without the blue sky; white snow remains an opaque fill. |
| `vectors/bc-parks-scene-with-white-frame.svg` | Scene with the optional white landscape frame. |
| `vectors/components/` | Separate sky, mountains/snowcaps, forest/shoreline, lake/reflections, and white frame. |
| `vectors/authored-redraw/` | Corresponding independently constructed editable-tree alternative. |
| `exports/bc-parks-scene-vector.pdf` | One-page, vector-only print export of the main scene. |
| `exports/bc-parks-scene-vector.eps` | Vector-only EPS export of the main scene. |
| `exports/bc-parks-scene-transparent-4000.png` | 4000-pixel-wide transparent raster convenience export; not a vector. |
| `previews/reference-vs-vector.png` | Actual supplied reference and the current vector render at a common scale. |
| `previews/badge-placement-proof.png` | Raster placement proof: original badge with the vector scene composited over it. The badge and lettering in this proof remain raster. |
| `alignment-viewer.html` | Offline reference/scene opacity comparison. |
| `source/` | Rebuilding scripts, palettes, alignment landmarks, and validation results. |
| `reference/` | Clearly identified raster references, separate from the artwork. |

## Alignment and editing

The full-artboard file has **viewBox `0 0 1122 1402`**, matching the supplied badge image. Keep both artboards at the same size and align their top-left page origins at `(0, 0)`. Do not fit only the landscape's visible bounding box to the full badge.

Geometry is authored in a normalized 1100 × 1375 coordinate system, then transformed precisely to the actual reference-image dimensions. The cropped scene files all use **viewBox `120 224 877 895`** in the full-reference coordinate system. This shared crop includes room for the optional white scene frame and preserves component registration.

All main component files share that crop. Place the white frame behind the scene and stack sky, mountains, forest, then lake without individually resizing them. Snowcaps are filled white objects rather than cutouts. Sky can be hidden or recoloured independently. The artwork is all solid colour; no gradients, bitmap filters, font dependencies, or linked artwork are required.

The main reference-fit version uses very small same-colour vector strokes around some fitted shapes to avoid antialias seams. These are normal editable SVG strokes, not raster effects. For a cutter that requires fills only, expand those strokes and clipping paths in your vector editor before toolpath preparation. Neither this package nor the EPS is a machine-specific cutting file.

## Fidelity

These are independent reconstructions of the supplied artwork, **not official original design files and not pixel-identical facsimiles**. Photographic texture, subtle shading, and print-edge irregularities are omitted. The frame is a clean geometric reconstruction. Individual branch contours and water-ripple details may differ, especially in the authored redraw. The comparison image and opacity viewer show the actual delivered geometry, not a separate idealized mockup.

## Regeneration

From this package folder, rebuild the authored alternative using Python's standard library:

```sh
python3 source/build_aligned_scene.py --out-dir .
```

Rebuild the reference-fit version with Python, Pillow, NumPy, SciPy, and OpenCV installed:

```sh
python3 source/build_reference_fit.py --out-dir .
```

The reference-fit script reads `reference/aligned-scene-preview.png` to construct editable regions. The authored script reads `source/base-landscape-redraw.svg` and does not read image pixels. Neither embeds either source into the resulting SVG.

These scripts regenerate SVG artwork and palette/alignment metadata. After geometry edits, regenerate the print exports and previews as well. For example:

```sh
inkscape vectors/bc-parks-scene-editable.svg --export-type=pdf --export-filename=exports/bc-parks-scene-vector.pdf
inkscape vectors/bc-parks-scene-editable.svg --export-type=eps --export-filename=exports/bc-parks-scene-vector.eps
inkscape vectors/bc-parks-scene-editable.svg --export-type=png --export-width=4000 --export-filename=exports/bc-parks-scene-transparent-4000.png
```

## Checks

The SVGs were parsed and checked for duplicate IDs, embedded raster images, text/font elements, external references, and missing local references. The scene and badge placement were rendered for inspection. The PDF was independently rendered with Poppler and checked for image and font objects. The EPS was converted to a test PDF and checked for image objects. Detailed results are in `source/validation.json`.
