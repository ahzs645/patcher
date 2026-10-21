#!/usr/bin/env node
// Build the unlabelled B.C. map and tree square (S48-O01) from the Forest Service evergreen emblem
// as PofBC draws it (Internal Logos → Forests → Forest Service evergreen emblem), the same mark.
//
//   node library/supplied/forest-service-emblem-square/compose.mjs [path/to/PofBC]   (then npm run library:import)
//
// The atlas's drawing had a rough four-point square, a coast-only map and a broad triangle. This takes
// the emblem's own shapes: its bowed badge as the patch's outline, the mainland and three islands, and
// the evergreen's crown and trunk. The badge is the green border and an inset copy of it the cloth
// field; the colours are the atlas's, read from the photograph of the cloth square.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const POFBC = process.argv[2] ?? join(HERE, '../../../../PofBC');
const emblem = readFileSync(join(POFBC, 'src/internal/forest-service-emblem.svg'), 'utf8');

// The atlas's thread colours for S48-O01.
const BORDER = '#315b36';
const FIELD = '#e6dcb0';
const MAP = '#60a779';
const TREE = '#111b12';

const d = (id) => new RegExp(`<path id="${id}"[^>]*\\sd="([^"]+)"`).exec(emblem)[1].replace(/\s+/g, ' ').trim();
const badge = d('badge');
const map = ['mainland', 'island-north', 'island-middle', 'island-south'].map(d);
const trunk = /<rect id="tree-trunk"[^>]*\/>/.exec(emblem)[0].replace(/ id="[^"]*"/, '');
const crown = /<polygon id="tree-crown"[^>]*\/>/.exec(emblem)[0].replace(/ id="[^"]*"/, '');

// The badge spans x 183–1065, y 173–1059, centred on (624, 616). The field is the badge drawn
// again 94% the size about that centre, which leaves a border about 26 units wide.
const INSET = 0.94;
const field = `translate(624 616) scale(${INSET}) translate(-624 -616)`;

const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="177 167 894 898" role="img">` +
  `<title>Forest Service evergreen emblem — cloth square</title>` +
  `<desc>The Forest Service evergreen emblem as PofBC draws it (its bowed badge, mainland and islands, crown and trunk), as a cloth patch in the atlas's thread colours: a green border, a cream field, the map in green and the evergreen dark.</desc>` +
  `<path data-component="border" d="${badge}" fill="${BORDER}"/>` +
  `<path data-component="field" d="${badge}" transform="${field}" fill="${FIELD}"/>` +
  `<g data-component="map" fill="${MAP}">${map.map((p) => `<path d="${p}"/>`).join('')}</g>` +
  `<g data-component="evergreen" fill="${TREE}">${trunk}${crown}</g></svg>`;

mkdirSync(join(HERE, 'composed'), { recursive: true });
writeFileSync(join(HERE, 'composed/S48-O01.svg'), svg);
console.log(`composed/S48-O01.svg: ${svg.length} bytes`);
