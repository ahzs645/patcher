# Forest Service evergreen emblem, cloth square

S48-O01, which the atlas called an unlabelled B.C. map and tree square, is the Forest Service evergreen
emblem: the white map of the province with a dark evergreen, on a badge whose sides bow outward. PofBC
draws it in Internal Logos → Forests
(<https://projects.ahmadjalil.com/PofBC/?view=internal&internal=forests&internal-logo=forest-service-emblem>).

```bash
node library/supplied/forest-service-emblem-square/compose.mjs ../PofBC   # writes composed/S48-O01.svg
npm run library:import
```

`compose.mjs` reads `src/internal/forest-service-emblem.svg` from PofBC and takes its shapes as they are:
the badge as the patch's outline and green border, the badge again at 94% about its centre as the cream
field, the mainland and three islands, and the evergreen's crown and trunk. The colours are the atlas's,
read from the photograph of the cloth square (border `#315b36`, field `#e6dcb0`, map `#60a779`, tree
`#111b12`). The printed mark on a spoon handle (S24-O01) is the same emblem and is left out of the library.
