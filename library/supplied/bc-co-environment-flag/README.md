# Conservation Officer / BC Environment, with the BC Parks flag

MC30-O01, the small 1992 Conservation Officer / BC Environment shield, with the flag beside BC drawn as
PofBC draws it: the waving flag of the BC Parks flag badge (Logos → BC Parks,
<https://projects.ahmadjalil.com/PofBC/?view=gallery&logos=bc-parks>). The atlas drew a small symbolic
flag there, two stroked outlines.

```bash
node library/supplied/bc-co-environment-flag/compose.mjs   # writes composed/MC30-O01.svg
npm run library:import
```

`compose.mjs` takes the atlas's drawing from the snapshot and keeps its border, provincial mark and
captions. It replaces the two flag paths with the flag's twelve shapes from
`../bc-parks-flag-badge/source/pofbc-flag-badge-ink.svg`, in the patch's cream thread, a little under the
height of the BC capitals and starting where the atlas's flag began. `preview-MC30-O01.webp` is the result
rendered in Chromium at 440 px wide.
