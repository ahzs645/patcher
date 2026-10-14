#!/usr/bin/env node
// Build the B.C. Hydro Security patch (S56-O21) with BC Hydro's own symbol, as PofBC draws it
// (Logos → BC Hydro → Full authority name), in place of the atlas's plain round H monogram.
//
//   node library/supplied/bc-hydro-security/compose.mjs [path/to/PofBC]   (then npm run library:import)
//
// The shield, its border and both captions are the atlas's reconstruction. The centre art (a cream
// oval and a block H) gives way to a light disc carrying the symbol: the ring round the two-star H,
// green over blue, drawn by PofBC's own symbolMarkup with the authority signature's settings.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { strFromU8 } from 'fflate';
import { readSnapshot, snapshotPath } from '../../../scripts/atlas-snapshot.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const POFBC = process.argv[2] ?? join(HERE, '../../../../PofBC');
const hydro = (file) => import(pathToFileURL(join(POFBC, 'src/hydro', file)).href);
const { hydroDefaults, hydroScene } = await hydro('hydroLayout.js');
const { symbolMarkup } = await hydro('renderHydroSvg.js');

const source = readSnapshot(await snapshotPath({}));
const design = source.index.designs.find((d) => d.id === 'S56-O21');
const atlas = strFromU8(source.get(design.svgUrl));

// The atlas's centre art: three groups, the oval and the H's two strokes.
const CENTRE = /<g data-component="specialty-centre-art">.*?<\/g>/g;
const centre = atlas.match(CENTRE);
if (centre?.length !== 3) throw new Error(`S56-O21: expected 3 centre-art groups, found ${centre?.length ?? 0}`);

// Where the oval sat, in the shield's master units: centre (50, 54 × 0.68), 15.64 high either side.
// The disc takes its height, round, as in the photograph; the ring sits on its edge.
const CX = 50;
const CY = 54 * 0.68;
const R = 23 * 0.68;
const DISC = '#eef0ec';
const [symbol] = hydroScene(hydroDefaults('authority')).symbols;
const placed = { ...symbol, x: CX - R, y: CY - R, size: 2 * R };
const art =
  `<g data-component="specialty-centre-art" data-source="PofBC bc-hydro-authority symbol">` +
  `<circle cx="${CX}" cy="${CY.toFixed(2)}" r="${R.toFixed(2)}" fill="${DISC}"/>` +
  `${symbolMarkup(placed, 'bc-hydro-symbol')}</g>`;

let first = true;
const svg = atlas.replace(CENTRE, () => (first ? ((first = false), art) : ''));

mkdirSync(join(HERE, 'composed'), { recursive: true });
writeFileSync(join(HERE, 'composed/S56-O21.svg'), svg);
console.log(`composed/S56-O21.svg: ${svg.length} bytes`);
