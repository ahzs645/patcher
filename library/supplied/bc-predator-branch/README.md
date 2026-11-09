# B.C. Game Department — Predator Branch (MC03-O01)

A supplied vector package (22 October 2026), used whole for MC03-O01. The atlas had drawn this
design as a limited-evidence study — the triangle and a pale wolf, with its captions left out because
the small historical catalogue illustration did not resolve them. This package follows a separate,
clean supplied illustration with interpreted captions: **B.C. GAME DEPARTMENT** on the two upper
sides and **PREDATOR BRANCH** across the foot, around a wolf's head.

- `vectors/bc-predator-branch-rebuilt.svg` — the master the library draws: 36 filled paths in seven
  named layers (black base, cream border, the animal, and the four lines of lettering, each letter its
  own path). No raster images, no live text, no fonts.
- `vectors/bc-predator-branch-construction.svg` — the same with the border and base as adjustable
  strokes, for changing the border's weight.
- `vectors/bc-predator-branch-vector.pdf` — one-page vector export.
- `source/` — how it was built: the border's six Bézier arcs, the animal's path, the fourteen glyphs
  and their placements (`build_patch.py`, which needs Python 3 and Inkscape).
- `review/` — the checks: the reference, the rebuild and their overlay (`comparison.webp`), and the
  numbers (`validation.json`): 95.1% foreground and 98.9% animal-head overlap with the reference at its
  own size, and the same 34 separate shapes in each.

## Source distinction from the November 8 review

The reference in `review/comparison.webp` is a **clean supplied illustration**. The
overlap figures above compare the reconstructed vector with that illustration;
they do not measure agreement with the separate small historical catalogue
illustration (157 × 173 pixels overall, with a 128 × 134 design crop). The atlas's
object inventory identifies that historical source as a **printed depiction** and
records the page owner's statement that they have not seen a physical example.
No photographed cloth specimen is available in this evidence set.

The historical illustration does not independently establish all of the resolved
lettering and animal detail in the larger supplied illustration or this package.
Keep illustration-to-vector agreement separate from fidelity to any physical
artifact. The gallery review therefore keeps MC03-O01 marked as source-limited
while retaining this authored drawing.

What it is not: an official master, or proof of the patch's date or size. It is a manual vector
reconstruction of a supplied image — authored curves, not a trace — with the source's shading
flattened to two colours (cream #EDE7DA, near-black #070706). Lettering, border curvature and the
animal's detail are close to the supplied illustration, not measured from an original artifact.
The page that published the historical illustration (moosecop.net) describes a 1951 shoulder patch;
that is its claim, not this package's.
