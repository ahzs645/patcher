#!/usr/bin/env node
// Build the University of British Columbia Patrol shield (S56-O57) with the university's arms.
//
//   node library/supplied/ubc-patrol-shield/compose.mjs   (then npm run library:import)
//
// Kept from the atlas: the navy patch with its gold edge, and the UNIVERSITY / OF / BRITISH COLUMBIA /
// PATROL lettering. Changed:
//
//   - the outline's lower edge is straight, as on the patch, where the atlas bowed it downward;
//   - the centre is the university's arms (source/British_columbia_univ_coat_arms.svg, see the README)
//     in place of the atlas's simplified shield of rectangles and stroked waves, its gold recoloured
//     to the patch's gold thread, as large as fits between BRITISH COLUMBIA and PATROL.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strFromU8 } from 'fflate';
import { readSnapshot, snapshotPath } from '../../../scripts/atlas-snapshot.mjs';
import { embed } from '../lettering/embed.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ID = 'S56-O57';
const source = readSnapshot(await snapshotPath({}));
const design = source.index.designs.find((d) => d.id === ID);
const atlas = strFromU8(source.get(design.svgUrl));

// The outline: the same top and sides, the bowed base (Q49 98, 95 deep at the middle) made a straight
// line at that depth, the sides carried down to meet it, so PATROL keeps its clearance.
const BOWED = 'M7 16 Q49 -6 94 17 L80 92 Q49 98 21 92 Z';
const BASE = 95;
const right = 80 + ((94 - 80) / (17 - 92)) * (BASE - 92);
const left = 21 + ((7 - 21) / (16 - 92)) * (BASE - 92);
const FLAT = `M7 16 Q49 -6 94 17 L${right.toFixed(2)} ${BASE} L${left.toFixed(2)} ${BASE} Z`;
if (!atlas.includes(`d="${BOWED}"`)) throw new Error(`${ID}: the atlas outline has changed`);
const GOLD = /stroke="(#[0-9a-f]{6})" stroke-width="3"/.exec(atlas)[1];

// The atlas's centre art: a run of specialty-centre-art groups between BRITISH COLUMBIA and PATROL.
const CENTRE = /(<g data-component="specialty-centre-art">[\s\S]*?<\/g>)+/;
if (!CENTRE.test(atlas)) throw new Error(`${ID}: the atlas centre art was not found`);

// In the master's units (the captions are not scaled): BRITISH COLUMBIA sits on y 36.55, PATROL's
// capitals rise to 76.5 − 1456 × 0.00715642 ≈ 66.1. The arms fill that gap less 1 unit at each end.
const arms = readFileSync(join(HERE, 'source/British_columbia_univ_coat_arms.svg'), 'utf8')
  .replace(/#b19672/gi, GOLD)
  // Commons' file carries a few invisible layout rectangles far outside the arms; leave them out.
  .replace(/<path d="m-[^"]*z" fill="none"\/>/g, '');
const placed = embed(arms, {
  x: 30, y: 37.6, width: 40, height: 27.4, prefix: 'ubc-arms',
  attrs: 'data-component="ubc-arms" data-source="supplied/ubc-patrol-shield/source/British_columbia_univ_coat_arms.svg"',
});

const svg = atlas
  .replace(`d="${BOWED}"`, `d="${FLAT}"`)
  .replace(CENTRE, placed.svg)
  .replace(/<title>[^<]*<\/title>/, '<title>University / British Columbia / Patrol — upper shield</title>' +
    '<desc>Navy patch with a gold edge and a straight lower edge. The University of British Columbia’s arms ' +
    '(Wikimedia Commons, after the 1915 design in the UBC Archives), its gold matched to the patch’s thread, ' +
    'between UNIVERSITY OF BRITISH COLUMBIA and PATROL. Interpreted from an 80 × 65 collector-board photograph: ' +
    'the embroidered alphabet, thread colours and the arms’ stitched detail are not verified.</desc>');

mkdirSync(join(HERE, 'composed'), { recursive: true });
writeFileSync(join(HERE, `composed/${ID}.svg`), svg);
console.log(`composed/${ID}.svg: ${svg.length} bytes; arms ${placed.box.width.toFixed(1)} × ${placed.box.height.toFixed(1)} at (${placed.box.x.toFixed(1)}, ${placed.box.y.toFixed(1)})`);
