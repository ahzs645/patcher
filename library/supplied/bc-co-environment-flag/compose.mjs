#!/usr/bin/env node
// Build the Conservation Officer / BC Environment patch (MC30-O01) with the BC Parks flag as PofBC
// draws it (Logos → BC Parks, the flag badge) beside BC, in place of the atlas's symbolic flag.
//
//   node library/supplied/bc-co-environment-flag/compose.mjs   (then npm run library:import)
//
// The border, the provincial mark and all three captions are the atlas's reconstruction. Its two
// stroked paths for the flag give way to the waving flag's twelve shapes from PofBC's flag badge
// (../bc-parks-flag-badge/source/pofbc-flag-badge-ink.svg), in the patch's cream thread.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strFromU8 } from 'fflate';
import { readSnapshot, snapshotPath } from '../../../scripts/atlas-snapshot.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const THREAD = '#e9e7dc';

const source = readSnapshot(await snapshotPath({}));
const design = source.index.designs.find((d) => d.id === 'MC30-O01');
const atlas = strFromU8(source.get(design.svgUrl));

const FLAG = /<path [^>]*data-component="interpreted-BC-flag(-detail)?"\/>/g;
if (atlas.match(FLAG)?.length !== 2) throw new Error('MC30-O01: expected the two interpreted flag paths');

// The flag's shapes, in their own units: 939.14 wide, 721.59 high (measured in Chromium).
const badge = readFileSync(join(HERE, '../bc-parks-flag-badge/source/pofbc-flag-badge-ink.svg'), 'utf8');
const shapes = badge.match(/<path data-role="flag"[^>]*\/>/g).join('').replace(/#000000/g, THREAD);
// The atlas's flag filled x 61–70, y 74–84 beside BC (caps 73.6–83); the waving flag takes the
// caps' height less a little, its left edge where the atlas's began.
const HEIGHT = 8.6;
const scale = HEIGHT / 721.59;
const flag =
  `<g data-component="pofbc-bc-parks-flag" transform="translate(60.2 74.2) scale(${scale.toFixed(6)})">${shapes}</g>`;

let first = true;
const svg = atlas.replace(FLAG, () => (first ? ((first = false), flag) : ''));

mkdirSync(join(HERE, 'composed'), { recursive: true });
writeFileSync(join(HERE, 'composed/MC30-O01.svg'), svg);
console.log(`composed/MC30-O01.svg: ${svg.length} bytes`);
