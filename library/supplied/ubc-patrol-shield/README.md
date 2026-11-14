# University / British Columbia / Patrol — upper shield (S56-O57)

`compose.mjs` keeps the atlas's navy field, gold edge and UNIVERSITY / OF / BRITISH COLUMBIA / PATROL
lettering, and changes two things:

- **A straight base.** The patch's lower edge is flat; the atlas bowed it downward. The base is now a
  straight line at the depth the bow reached in the middle, with the sides carried down to meet it, so
  PATROL keeps its clearance.
- **The university's arms** in place of the atlas's simplified shield (rectangles and stroked waves), from
  `source/British_columbia_univ_coat_arms.svg`, at their own proportions and as large as fits between
  BRITISH COLUMBIA and PATROL. Their gold is recoloured to the patch's gold thread; a few invisible layout
  rectangles in the file are left out.

```bash
node library/supplied/ubc-patrol-shield/compose.mjs   # then npm run library:import
```

## Source

`source/British_columbia_univ_coat_arms.svg` is
[File:British columbia univ coat arms.svg](https://commons.wikimedia.org/wiki/File:British_columbia_univ_coat_arms.svg)
on Wikimedia Commons: drawn from an image in the UBC Archives' heraldry pages, after the 1915 design, and
marked public domain in Canada and the United States. Commons notes it may differ from the version the
university uses today.

The embroidered arms are squatter than the drawn ones, and PATROL's tall condensed alphabet is still the
atlas's wider one.
