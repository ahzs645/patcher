#!/usr/bin/env node
// Build the unlabelled B.C. map and tree square (S48-O01) from the Forest Service evergreen emblem
// as PofBC draws it (Internal Logos → Forests → Forest Service evergreen emblem), the same mark.
//
//   node library/supplied/forest-service-emblem-square/compose.mjs [path/to/PofBC]   (then npm run library:import)
//
// The mainland, islands, crown and trunk remain PofBC's emblem shapes. The cloth specimen has nearly
// straight sides and small rounded corners, so its border is constructed independently of the
// deeply bowed printed-emblem badge. The nearly square canvas and existing interior geometry stay
// unchanged; the oblique photograph is not treated as evidence for physical width/height or colour.

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
const map = ['mainland', 'island-north', 'island-middle', 'island-south'].map(d);
const trunk = /<rect id="tree-trunk"[^>]*\/>/.exec(emblem)[0].replace(/ id="[^"]*"/, '');
const crown = /<polygon id="tree-crown"[^>]*\/>/.exec(emblem)[0].replace(/ id="[^"]*"/, '');

// Retain the previous outline's extrema and centre: x 183–1065, y 173–1059, (624, 616).
// The 26-unit border preserves the previous approximate edge weight. The 36-unit outer radius
// and 10-unit inner radius are a regularized construction, not a measured embroidery specification.
const BORDER_WIDTH = 26;
const OUTER_RADIUS = 36;
const outer = { x: 183, y: 173, width: 882, height: 886, rx: OUTER_RADIUS };
const inner = {
  x: outer.x + BORDER_WIDTH, y: outer.y + BORDER_WIDTH,
  width: outer.width - 2 * BORDER_WIDTH, height: outer.height - 2 * BORDER_WIDTH,
  rx: OUTER_RADIUS - BORDER_WIDTH,
};
const rect = (component, box, fill) => `<rect data-component="${component}" ${Object.entries(box).map(([key, value]) => `${key}="${value}"`).join(' ')} fill="${fill}"/>`;

const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="177 167 894 898" role="img">` +
  `<title>Forest Service evergreen emblem — cloth square</title>` +
  `<desc>Reference-based cloth-square reconstruction with independently constructed straight sides and modest rounded corners. PofBC's mainland, islands, crown and trunk are retained. The existing green, cream and dark palette is interpreted; physical proportions, exact thread colours and fine details are not established by the photograph.</desc>` +
  rect('border', outer, BORDER) +
  rect('field', inner, FIELD) +
  `<g data-component="map" fill="${MAP}">${map.map((p) => `<path d="${p}"/>`).join('')}</g>` +
  `<g data-component="evergreen" fill="${TREE}">${trunk}${crown}</g></svg>`;

mkdirSync(join(HERE, 'composed'), { recursive: true });
writeFileSync(join(HERE, 'composed/S48-O01.svg'), svg);
console.log(`composed/S48-O01.svg: ${svg.length} bytes`);
