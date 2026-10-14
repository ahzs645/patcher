# BC Parks — Recreation and Conservation vector package

## Open this first

**`vectors/bc-parks-recreation-conservation-outlined.svg`** is the main artwork. It is an actual layered vector reconstruction: the badge, border, flower, and lettering are editable SVG paths, not a bitmap inside an SVG wrapper. All lettering in this master is outlined, so it does not need fonts installed.

The design follows the supplied historic embroidered patch photograph. The layered arch / shoulder / frame construction and registered-component approach follow the supplied BC Parks scene package, but the proportions have been rebuilt for this Recreation and Conservation patch. The landscape scene itself is not part of this badge.

## Included files

- **Outlined SVG master** — six named top-level layers: outer edging/navy field, white interior frame, dogwood, arched header, department wording, and custom PARKS lettering.
- **Editable-text SVG** — same design with editable header/body characters. The curved heading uses individually positioned characters; body lettering is also positioned per character. PARKS remains custom path lettering. This is not a one-click text-reflow template.
- **Photo-aligned SVG** — same artwork on a 1080 × 1080 artboard, for comparing with `reference/original-patch.jpg`.
- **Vector PDF and EPS** — outlined print/interchange exports, with no raster artwork or font dependencies.
- **4000-pixel-wide transparent PNG** — raster convenience export, not a vector.
- **Separate components** — badge/frame; registered dogwood; registered lettering; a blank-wording rebranding template; and a tightly cropped dogwood.
- **Comparison and overlay previews** — rendered from the delivered SVG itself, not from the earlier image-generation preview.
- **Build script, palette/design metadata, and validation report** — under `source/`.

## Layers and editing

The outlined master contains six named layers. Within the dogwood group, the seven leaves, leaf veins, five white petals, gold center, and center divisions are independent paths/groups. The top text and the four department lines are separate groups. The PARKS letters are individually editable custom outlines.

The white interior frame is a compound filled path, and the outside edging is white geometry underneath the navy field. White edging can disappear visually against a white canvas: use a grey canvas or the comparison preview to see its full extent. White is not transparent.

The flower contains ordinary vector strokes. For a cutter or other workflow requiring only filled contours, expand strokes in the target editor and inspect joins at the intended production size. This is not a machine-ready embroidery, stitch, or cutting file.

## Registration and size

The main artboard has `viewBox="155 65 730 940"` and is set to **100 mm × 128.767 mm**, including a small clear margin. This is a convenient export size, not a verified measurement of the physical patch.

The photo-aligned file has `viewBox="0 0 1080 1080"`. Align its page origin to the original photograph's top-left corner without separately fitting its visible artwork bounds. The photograph remains tilted and distorted by fabric; the vector is straightened.

Components `01` through `04` share the main master artboard and register without resizing. Component `05-dogwood-isolated.svg` is tightly cropped to `viewBox="350 230 330 320"` for standalone use.

Open **`alignment-viewer.html`** in a browser for an offline opacity-slider comparison. Keep the extracted directory structure intact so the relative image/SVG links work.

## Colours

These are visually selected flat RGB colours, not verified historical ink or thread specifications:

| Element | RGB hex |
| --- | --- |
| Navy field | `#102338` |
| Gold lettering / center | `#E9BE36` |
| White petals / edging / frame | `#FFFFFF` |
| Green leaves | `#97CA69` |
| Leaf veins | `#578044` |
| Flower outlines | `#07111C` |

No gradients, photographic stitching, fabric texture, filters, or embedded reference bitmaps are used in the artwork.

## Typeface and fidelity notes

This is an independent reconstruction, **not a recovered official original or a pixel-identical facsimile**. The embroidered reference does not establish its exact historical typefaces. The header uses **Roboto Slab Bold as a visual substitute**; the body uses proportion-adjusted **Liberation Sans Bold**. PARKS uses newly constructed extended letter outlines. The editable-text file needs the substitute typefaces to retain its appearance; font files are not included. Use the outlined master for reliable interchange.

The dogwood silhouette, leaf serrations, lettering proportions, frame geometry, and colours are reconstructed interpretations. Embroidery irregularities, edge wear, fabric distortion, and thread texture are deliberately omitted. Compare the actual vector to the photo before using it as a historical facsimile.

## Rebuild

The SVG construction script requires Python 3.10+, `fonttools`, and the two substitute typefaces. On a system with Fontconfig it locates the fonts through `fc-match`. Explicit paths may be supplied instead:

```sh
python3 source/build_vectors.py --out-dir . \
  --header-font /path/to/RobotoSlab-Bold.otf \
  --body-font /path/to/LiberationSans-Bold.ttf
```

This script uses authored path coordinates and font outlines, not bitmap sampling or automatic contour tracing. It generates SVGs and design metadata; it does not automatically refresh PDF/EPS/PNG exports or comparison images. Inkscape export examples:

```sh
inkscape vectors/bc-parks-recreation-conservation-outlined.svg \
  --export-type=pdf --export-filename=exports/bc-parks-recreation-conservation-vector.pdf
inkscape vectors/bc-parks-recreation-conservation-outlined.svg \
  --export-type=eps --export-filename=exports/bc-parks-recreation-conservation-vector.eps
inkscape vectors/bc-parks-recreation-conservation-outlined.svg \
  --export-type=png --export-width=4000 \
  --export-filename=exports/bc-parks-recreation-conservation-transparent-4000.png
```

## Checks performed

SVG XML structure, IDs, raster elements, text elements, external references, and required layers were checked programmatically. The main artwork and editable-type variant were rendered in Inkscape and visually compared. The PDF was independently rendered with Poppler and checked for image/font resources. See `source/validation.json` for results. The comparison previews show the actual delivered geometry.
