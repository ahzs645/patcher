# Fish & Game and Predator Control felt rockers

Three things distinguish this reconstruction from the old atlas typography:
the captions are constructed from a small original stroke alphabet, each curved
row has its own placement controls, and the outlines are proportioned from the
supplied photograph rather than borrowed unchanged from the related Wildlife
Protection flash.

## Designs

| Atlas item | Artwork | Reference relationship |
|---|---|---|
| MC12-O01 | BRITISH COLUMBIA / FISH & GAME BRANCH | The upper patch in the paired photo; MC13-O01 is another sighting of this item. |
| MC13-O02 | PREDATOR CONTROL / DIVISION | The lower, separate patch in the same photo. |

The supplied photograph is `reference.png` (306 × 172). Its source and checksum
are in `provenance.json`. It contains two physical patches. Each is delivered as
its own SVG, preserving the catalogue's existing organization and IDs.

## Lettering and geometry

- The uppercase alphabet is manually drawn from straight strokes and cubic
  Bezier bowls. It is not an identified historical font or an outlined substitute
  typeface. M has a shallow central V, R has a direct diagonal leg, and I is a
  simple stem. The ampersand is an independent constructed glyph.
- Each text row has independent cap height, visible span, tracking, stroke width,
  baseline and curvature in `compose.py`. Glyphs are placed at geometric arc-length
  intervals, then rotated to their row's tangent. They are not warped.
- The title rocker uses two independent curved rows and bevelled ends. The inner
  outline is deliberately deeper at the centre than the old atlas reconstruction
  so both rows have appropriate clearance.
- The division flash is one connected closed silhouette. Its centre tab is
  narrower than the previous reconstruction. PREDATOR CONTROL follows a curved
  baseline; DIVISION is horizontal and has its own width and cap-height settings.
- Lettering groups retain `data-caption` and `data-live-text`, so Patcher can
  identify the letters for its raised satin-stitch pass.

## Rebuild

Requires Python 3, Pillow and Inkscape. No installed font or photograph is read by
the generator.

```sh
python library/supplied/bc-fish-game-rockers/compose.py
npm run library:import
npm run library:verify -- --source
```

For each ID, the script writes an editable SVG with vector centreline strokes,
an SVG with the strokes expanded into filled paths, a transparent PNG, a library
WebP preview and a JSON layout with every glyph's placement. Inkscape performs
only vector stroke expansion and raster preview rendering. There is no bitmap
tracing, embedded raster artwork, live text, or external font dependency in the
final SVGs.

## Validation and limits

The reference, previous artwork and redraw were compared visually. Final renders
at 1200 pixels wide contain exactly 31 separate gold components for MC12-O01
(30 glyphs and its border) and 24 for MC13-O02 (23 glyphs and its border). This
checks that adjacent letters and borders do not accidentally touch. All final
paths remain within their viewBoxes. The generated SVGs also pass the existing
library import and source-hash verification and exercise Patcher's digitizer,
including raised text and DST/EXP record generation.

The small photograph supports the overall construction, wording, spacing and
lettering character. It does not resolve every embroidered contour. The regular
curves and flat colours are deliberate reconstruction choices; physical size,
thread colours, original alphabet identity and manufacturing stitch settings
remain unverified. These are reconstructions, not recovered government masters.
