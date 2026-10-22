# B.C. Game Department — Predator Branch (MC03-O01)

A supplied vector package (22 October 2026), used whole for MC03-O01. The atlas had drawn this
patch as a limited-evidence study — the triangle and a pale wolf, with its captions left out because
its 157 × 173 photograph would not read. This package reads them: **B.C. GAME DEPARTMENT** on the
two upper sides and **PREDATOR BRANCH** across the foot, around a wolf's head.

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

What it is not: an official master, or proof of the patch's date or size. It is a manual vector
reconstruction of a supplied image — authored curves, not a trace — with the source's shading
flattened to two colours (cream #EDE7DA, near-black #070706). Lettering, border curvature and the
animal's detail are close to the reference, not measured from an original. The page that published
the photograph (moosecop.net) describes a 1951 shoulder patch; that is its claim, not this package's.
