# Compact Conservation Officer shields: heading review

This package makes a **partial refinement** of MC27-O01, MC28-O01 and MC29-O01.
The three original photographs show a curved light divider below CONSERVATION
OFFICER. The previous reconstructed SVGs omitted it and placed BRITISH COLUMBIA
too high and too narrowly, immediately under the upper caption.

The update restores that visible divider and gives BRITISH COLUMBIA its own
lower, wider arc. It preserves the existing individual letter outlines, scaling
each uniformly, then positioning and rotating it as a rigid glyph. There is no
letter warping, contour tracing, image embedding or live font requirement.

## Sources actually inspected

The source crops and coordinates come from the atlas snapshot already used by
Patcher. Rectangles are **[x0, y0, x1, y1]**, in native image pixels.

| Design | Original image | Source size | Crop rectangle | Crop size |
| --- | --- | --- | --- | --- |
| MC27-O01 | [1984-captioned source](https://moosecop.net/History/BC_CO_Min_of_Env_1st_version.jpg) | 323 × 307 | [2, 5, 320, 306] | 318 × 301 |
| MC28-O01 | [Environment and Parks source](https://moosecop.net/History/BC_CO_Min_of_Env_Parks.jpg) | 305 × 306 | [2, 2, 303, 305] | 301 × 303 |
| MC29-O01 | [Later narrow-footer source](https://moosecop.net/History/BC_CO_Min_of_Env_2nd_version.jpg) | 304 × 298 | [2, 1, 303, 297] | 301 × 296 |

Dates remain the source catalogue's attribution. The photographs do not
authenticate issue dates, physical dimensions, original alphabets or thread
specifications.

## What changed, and what remains to review

The authored divider is a single quadratic curve with a 1.4-unit stroke in the
unchanged 100 × 100 master frame. The British Columbia row has an independent
parabolic baseline, wider glyph positions and a small uniform glyph-size
increase. These are editable layout choices supported by the visible separation
and extent of the source captions, not measured original production dimensions.

The outer cut, boxed provincial arms, upper caption, lower ministry captions and
palette remain the previous interpretations. The lower captions still need
their own letterform/spacing review, particularly MC29's narrow-footer edition.
The boxed arms still need a source-specific embroidery review. This package
does not declare the three designs fully faithful or ready for manufacture.

`review/source-before-after.jpg` displays the source crop, previous vector and
partial refinement at a useful viewing size. Each image is uniformly scaled to
fit its panel; this is a visual comparison, not registration or an accuracy score.

## Rebuild

`source/*-original.svg` freezes the fully joined baseline from Patcher commit
`1e41f5e01a517d2232197ff57ba5b4f1c9d0636e`. `source/baseline.json` records its
SHA-256 hashes. Rebuilding reads these frozen files, so updating the generated
library cannot accidentally apply the transformation twice.

The SVG and layout build needs only Node:

```sh
node library/supplied/co-compact-shields-review/compose.mjs
```

For preview PNGs, point to an existing installation of `@resvg/resvg-js` (PofBC
already depends on it), then use Pillow for the 440-pixel WebP previews:

```sh
node library/supplied/co-compact-shields-review/compose.mjs \
  --resvg-module /absolute/path/to/node_modules/@resvg/resvg-js
python3 library/supplied/co-compact-shields-review/render_previews.py
```

To rebuild the source comparison as well, pass the extracted atlas `dist`
directory with `--atlas-dir /absolute/path/to/atlas/dist` to the Python command.
The source photographs are read unchanged from that snapshot.

The generated organization SVGs and library manifest must be refreshed through
the usual `orgs.json` replacement configuration and `library:import` command.
Do not hand-edit those generated files.
