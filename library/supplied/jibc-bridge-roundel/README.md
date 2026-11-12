# Justice Institute of British Columbia — roundel (S56-O36)

The atlas drew this gold and navy roundel with a schematic triangular bridge in the centre, from a
58 × 57 crop of a collector board. The centre is the Justice Institute's monogram, the triangle with
B and C that its fan shield (S56-O46) carries.

`compose.mjs` takes the atlas drawing from the snapshot and swaps its bridge (one stroked path) for the
four paths of `../jibc-fan-badge/vectors/JIBC_Monogram.svg`, filled in the roundel's gold (#cdb171) and
centred where the bridge sat, 52 units wide, as wide as the photograph shows it. The ring, the disc and
BRITISH COLUMBIA are the atlas's. The photograph's upper caption (Justice Institute) is still left out,
as the atlas left it.

```bash
node library/supplied/jibc-bridge-roundel/compose.mjs   # then npm run library:import
```
