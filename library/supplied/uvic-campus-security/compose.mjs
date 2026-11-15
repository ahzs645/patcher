#!/usr/bin/env node
// Build the University of Victoria Campus Security Services shield (S56-O59) from the atlas drawing.
//
//   node library/supplied/uvic-campus-security/compose.mjs   (then npm run library:import)
//
// The atlas filed this patch under UBC and read its lower lettering as UNIVERSITY OF / BRITISH
// COLUMBIA. The photograph shows the University of Victoria's arms (a chief with three martlets over
// an open book) with UNIVERSITY OF VICTORIA curving under the shield and SERVICES across the bottom:
// Campus Security Services, University of Victoria. Kept from the atlas: the navy patch, its gold
// edge, and CAMPUS and SECURITY. Replaced:
//
//   - the centre: the university's shield (source/uvic-shield.svg, cut from its full arms by
//     extract-shield.mjs, see the README), in place of the atlas's red-and-blue interpretation;
//   - the lower lettering: UNIVERSITY OF VICTORIA on a circle under the shield and SERVICES on a
//     wider one beneath it, both standing inward, in Roboto Condensed Bold and the patch's gold.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strFromU8 } from 'fflate';
import { readSnapshot, snapshotPath } from '../../../scripts/atlas-snapshot.mjs';
import { arc, face, trackingFor } from '../lettering/lettering.mjs';
import { embed } from '../lettering/embed.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ID = 'S56-O59';
const source = readSnapshot(await snapshotPath({}));
const design = source.index.designs.find((d) => d.id === ID);
const atlas = strFromU8(source.get(design.svgUrl));

const CENTRE = /(<g data-component="specialty-centre-art">[\s\S]*?<\/g>)+/;
const LOWER = /<g data-caption="UNIVERSITY OF">[\s\S]*?<\/g><g data-caption="BRITISH COLUMBIA">[\s\S]*?<\/g>/;
if (!CENTRE.test(atlas) || !LOWER.test(atlas)) throw new Error(`${ID}: the atlas centre art or lower captions were not found`);
const GOLD = /stroke="(#[0-9a-f]{6})" stroke-width="3"/.exec(atlas)[1];

// In the master's units: SECURITY sits on y 34.85; the outline's bowed base is 95 × 0.85 ≈ 80.8 deep
// at the middle. The shield goes from y 38 to 61, centred; both lower lines curve about (50, 46).
const shield = embed(readFileSync(join(HERE, 'source/uvic-shield.svg'), 'utf8'), {
  x: 30, y: 38, width: 40, height: 23, prefix: 'uvic-shield',
  attrs: 'data-component="uvic-shield" data-source="supplied/uvic-campus-security/source/uvic-shield.svg"',
});

const rc = face('roboto-condensed-bold');
const about = { cx: 50, cy: 46, side: 'bottom', fill: GOLD };
// UNIVERSITY OF VICTORIA: capitals from radius 18.6 (3.6 clear of the shield's point) to 22,
// spread over 170° so it rises beside the shield as the photograph shows.
const U_TEXT = 'UNIVERSITY OF VICTORIA';
const U_CAP = 3.4;
const U_R = 22;
const university = arc(rc, U_TEXT, {
  ...about, radius: U_R, capHeight: U_CAP,
  tracking: trackingFor(rc, U_TEXT, U_CAP, (170 / 180) * Math.PI * U_R),
});
// SERVICES: baseline 30.5 out (y 76.5 at the middle, 3 clear of the edge), capitals 4.8 high, so
// 3.7 clear of UNIVERSITY OF VICTORIA.
const services = arc(rc, 'SERVICES', { ...about, radius: 30.5, capHeight: 4.8, tracking: 0.7 });

const svg = atlas
  .replace(CENTRE, shield.svg)
  .replace(LOWER, university + services)
  .replace(/<title>[^<]*<\/title>/, '<title>Campus Security / University of Victoria — shield</title>' +
    '<desc>Navy patch with a gold edge: CAMPUS and SECURITY over the University of Victoria’s shield (three ' +
    'martlets over an open book, from the university’s arms), with UNIVERSITY OF VICTORIA curving beneath it ' +
    'and SERVICES across the bottom. Interpreted from a 78 × 62 collector-board photograph: the embroidered ' +
    'alphabet, thread colours and the shield’s stitched detail are not verified.</desc>');

mkdirSync(join(HERE, 'composed'), { recursive: true });
writeFileSync(join(HERE, `composed/${ID}.svg`), svg);
console.log(`composed/${ID}.svg: ${svg.length} bytes; shield ${shield.box.width.toFixed(1)} × ${shield.box.height.toFixed(1)} at (${shield.box.x.toFixed(1)}, ${shield.box.y.toFixed(1)})`);
