# British Columbia / Game / Warden (MC05-O01)

This reconstruction follows the supplied 1326 × 636 photograph of the green felt Game Warden patch.
The photograph is kept unchanged as `reference.png`; its SHA-256 and original upload name are in
`provenance.json`. The catalogued source is [BC Game Warden](https://moosecop.net/History/BC_Game_Warden.jpg).

The former atlas drawing had a generic sans-serif upper line with small, wide letters and flat,
widely spaced lower rows. This version rebuilds the characteristic lettering and its layout from
simple, editable vector geometry:

- A 1260 × 580 frame preserves the approximately 2.18:1 felt silhouette. The top is a pair of smooth
  cubic curves; the sides are vertical and the bottom is straight. The gold inset is constructed
  independently, at the photograph's observed approximately 50-unit top and 56-unit side inset.
- **BRITISH COLUMBIA** uses a custom narrow monoline alphabet. Each capital has its own vertical
  placement and a small 0–6° lean. The upper line follows the observed arch without strongly
  rotating its outside letters around a circle. Skeleton cap heights are 105–115 units; the final
  rounded strokes make the visible capitals approximately 120 units high.
- **GAME** is approximately 334 units wide and **WARDEN** approximately 508 units wide, with
  visible cap heights approximately 106–116 units. Their widths and closely stacked placement are
  independent of the upper line. They use broader versions of the same constructed alphabet.
- The **M** has its middle vertex halfway down; the **W** has a lowered central peak. **R** has a
  direct diagonal leg. **C/O** are narrow round-ended bowls. These are observed visual features,
  not a claim to have identified a historical commercial font.
- The reference's worn felt, stitch texture, variable thread thickness and slight photographic
  asymmetry are regularized. Green and gold are interpreted colours, not calibrated thread values.

## Files and rebuild

```bash
python3 library/supplied/bc-game-warden/compose.py
```

Requires Python 3, Pillow and Inkscape. The script writes:

| File | Purpose |
| --- | --- |
| `MC05-O01-editable.svg` | Master with semantic groups and editable centerline Bézier glyphs |
| `MC05-O01.svg` | Released artwork with strokes expanded to filled vector paths |
| `preview-MC05-O01.webp` | 440-pixel library card preview rendered from the released SVG |
| `MC05-O01.png` | Full-width transparent preview rendered from the released SVG |
| `layout.json` | Rebuild dimensions, colours and per-glyph positions |

`compose.py` contains the alphabet, layout positions and constructed outline. It does not open the
reference image or use contour extraction, optical character recognition, an installed font or an
embedded raster. Inkscape only expands the script's vector pen strokes. The released SVG contains no
live `<text>` elements, font dependencies or images. `data-caption` and `data-live-text` remain on each
lettering group so Patcher can identify them for the raised-lettering embroidery pass.

The library `replace` entry should point to `MC05-O01.svg` and `preview-MC05-O01.webp`; run the normal
`library:import` afterwards. Do not hand-edit the generated organization files or manifest.

The final render was checked for lettering collisions: its 26 separate gold components are the 25
letters and the inset border. No letters join adjacent letters or the border. A repeated build produced
byte-identical SVG, editable master, PNG, WebP and layout JSON with the same installed toolchain.

This is a reference-based reconstruction. The original production alphabet, physical dimensions,
thread colours and stitch specification remain unverified. The PNG is a flat artwork preview; a
finished embroidery file still requires the usual sewing validation.
