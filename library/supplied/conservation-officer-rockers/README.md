# Conservation Officer title rockers

| Design | Reference photograph | Construction |
| --- | --- | --- |
| MC19-O02 | [Olive lower rocker](https://github.com/ahzs645/PofBC/blob/27c0f4589eefa0cbfee21e1b5a597980ce7fae96/public/patch-review/crops/MC19-O02.webp) | Olive cloth, plain edge and narrow gold caption. |
| MC20-O02 | [Green and gold lower rocker](https://github.com/ahzs645/PofBC/blob/27c0f4589eefa0cbfee21e1b5a597980ce7fae96/public/patch-review/crops/MC20-O02.webp) | Deeper cut, gold edging and a heavier caption on green cloth. |
| S56-O40 | [MC26-O01 upper rocker](https://github.com/ahzs645/PofBC/blob/27c0f4589eefa0cbfee21e1b5a597980ce7fae96/public/patch-review/crops/MC26-O01.webp) | Pale edging and a heavier white caption on a dark upper arch. The catalogue also records the small S56 collector-board sighting. |

Run `node library/supplied/conservation-officer-rockers/compose.mjs` from the repository root to rebuild the three SVGs. Each JSON file contains a Bézier outline and 19 placements, in reading order. Each placement gives the centre in crop pixels, clockwise angle in degrees and horizontal and vertical scales relative to the 28-unit capitals in `glyphs.mjs`. The parameters were fitted to the visible lettering in each specimen. The photographs do not establish the exact embroidery alphabet, thread colours or physical size.

The transparent WebP previews are 440 pixels wide. The browser sewing profiles in `library/profiles.json` distinguish the plain olive edge from the two bound edges.
