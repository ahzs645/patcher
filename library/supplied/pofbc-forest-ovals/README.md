# PofBC Forest Ovals

PofBC's drawings of the Forest Service and Wildfire Service ovals (Internal Logos → Forests), with their
variants, as outlined SVG. `orgs.json` (`consolidate`) puts them in the place of the atlas's separate
reconstructions of the same ovals.

| Folder | What | Made by |
|---|---|---|
| `forest-service/` | The Forest Service tree oval: PofBC's colourways, Wildfire Management (colour and black), Fire Control, and the Airtanker Operations package | `capture.mjs` |
| `forests/` | British Columbia / Forests wildlife oval, and its Wildfire Service edition | `capture.mjs` |
| `long-ministry/` | The long ministry-name wildlife oval, its Wildfire Service edition, and Ministry of Forests | `capture.mjs` |
| `yellow-sky/` | PofBC's yellow-sky oval: green, cream, and a dark recolour | `drawings.mjs` |
| `green-gold/` | PofBC's green-and-gold oval: full colour, PofBC's black recolours, and a light-band recolour | `drawings.mjs` |

To rebuild, from the Patcher root:

```bash
# capture.mjs: in a PofBC checkout, run `npx vite --port 5190`, then
node library/supplied/pofbc-forest-ovals/capture.mjs http://localhost:5190 ../PofBC
node library/supplied/pofbc-forest-ovals/drawings.mjs ../PofBC
npm run library:import
```

`capture.mjs` renders each variant in a browser with the same Forest Oval engine, recipe, theme and colours
PofBC's Internal Logos view uses, then reads each letter's position and angle back from the page and draws
it from the same font file (fontkit), so the result needs no fonts. The Noto Sans condensed face is
instanced from its variable font with fontTools (`pip install fonttools`). It needs Playwright
(`PLAYWRIGHT=/path/to/playwright/index.mjs` if it isn't installed here).

Each `.webp` is its SVG rendered in Chromium, cropped to the drawing, and scaled to 440 px.

These are reference-based reconstructions, not authenticated issue artwork. Colourways with no atlas entry
are generated recolours; `orgs.json` says which.
