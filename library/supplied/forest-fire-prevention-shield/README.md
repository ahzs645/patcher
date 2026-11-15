# Forest Fire / Prevention Officer — tree shield (S51-O01)

The atlas drew this badge's inner oval emblem with the shared historic pine: a thin, symmetrical,
open-branched tree. The badge has a broad, solid, tiered and asymmetric conifer, and two separator
dots the atlas left out. (PofBC's curved badge trial noted the same mismatch.)

`compose.mjs` keeps the atlas's shield, rims and FOREST FIRE / PREVENTION OFFICER lettering and
replaces the inner emblem: the oval border, the conifer, the two dots, and BRITISH COLUMBIA / FOREST
SERVICE.

```bash
node library/supplied/forest-fire-prevention-shield/compose.mjs   # then npm run library:import
```

## Sources

- `source/photograph-674x676.png`: a close-up photograph of the emblem
  (SHA-256 `7f5415ae…6f1655`).
- `source/reviewed-emblem.svg`: a hand-built vector reconstruction of the emblem from that photograph,
  with the tree, dots and letters in the photograph's own pixel coordinates (SHA-256 `f5a13f44…7066a`).
  No raster, auto-trace or font.
- `review/`: an overlap review of that reconstruction against the photograph (its README, its
  measurements, and the details sheet). It lists corrections and does not apply them. Its full PDF,
  contour overlays and profile table were supplied with it and are not kept here.

## The review's corrections, as applied

Each takes the middle of the review's suggested range, in photograph pixels.

| Finding | Applied |
|---|---|
| Lower-left notch cuts 8–15 px too deep (tip at 325, 402; photo about 310–318, 401–408) | Tip moved to (314, 404.5) |
| The small lower-left bough sits 3–6 px low | Raised 4.5 px |
| The upper neck's right edge is 4–7 px too pinched | Moved out 5.5 px |
| The trunk's left edge may be 3–6 px too wide (lower confidence) | In 3 px |
| FOREST: E, S and T drift right on too flat an arc | E (237.5, 523.5) at 40°, S (261, 545.5) at 32.5°, T (287, 562) at 30° |
| The dots are smaller than the relief (17 × 20 px; about 22–24 × 28–32) | 23 × 30, same centres |
| The right side of the border has the largest offset from the photograph's ridge | The border is drawn on the review's fitted ellipse (centre 351.0, 321.7; radii 237.2 × 295.2; −3.075°) |

The review notes its targets are visual estimates and the ridge is a photographic highlight, not the
die's edge; these are the best available, not authenticated geometry.

## Fitting it to the badge

The fitted ellipse is turned upright and mapped onto the atlas's inner oval (centre 503, 503; radii
221 × 290 in its template units). The close-up shows the oval a little wider (0.80) than the whole
badge's photograph and the atlas's oval do (0.76), likely because the close-up was taken slightly
obliquely, so the emblem is scaled about 5% more across than down to sit in the badge as the whole
photograph shows it.
