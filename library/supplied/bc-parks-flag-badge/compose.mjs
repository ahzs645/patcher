#!/usr/bin/env node
// Build the BC Parks flag patches from PofBC's flag badge (source/pofbc-flag-badge-ink.svg, see README).
//
//   node library/supplied/bc-parks-flag-badge/compose.mjs   (then npm run library:import)

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strFromU8 } from 'fflate';
import { readSnapshot, snapshotPath } from '../../../scripts/atlas-snapshot.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const THREAD = '#164b47';
const CLOTH = '#ebeaf4';

const badge = readFileSync(join(HERE, 'source/pofbc-flag-badge-ink.svg'), 'utf8').replace(/#000000/g, THREAD);
const frame = /<path data-role="frame"[^>]*\/>/.exec(badge)[0];
// The frame is two contours filled even-odd; the first is its outer edge, which the cloth fills.
const outer = /\sd="(M[^M]*)/.exec(frame)[1].trim();
// Everything drawn after the frame: the flag and the two words.
const wordmark = badge.slice(badge.indexOf(frame) + frame.length, badge.lastIndexOf('</svg>'));

const DESC = 'BC Parks flag badge as PofBC draws it (frame, flag and outlined BC / Parks), in the atlas’s thread colours.';

// S30-O01, the rounded square: the badge whole, cut at its frame.
const square =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 497.02 497.19" role="img">` +
  `<title>BC Parks flag — rounded square</title><desc>${DESC}</desc>` +
  `<path data-role="cloth" d="${outer}" fill="${CLOTH}"/>${frame}${wordmark}</svg>`;

// S30-O02, the semicircle: the atlas's cut and border, its wording and flag replaced by the badge's.
// Measured in a browser with getBBox: the badge's wording block, and the atlas's in its master units.
const WORDMARK = { x: 56.463, y: 119.407, width: 383.865, height: 257.348 };
const TARGET = { x: 29.366, y: 13.091, width: 44.634, height: 29.13 };
const scale = Math.min(TARGET.width / WORDMARK.width, TARGET.height / WORDMARK.height);
const tx = TARGET.x + (TARGET.width - WORDMARK.width * scale) / 2 - WORDMARK.x * scale;
const ty = TARGET.y + (TARGET.height - WORDMARK.height * scale) / 2 - WORDMARK.y * scale;

const source = readSnapshot(await snapshotPath({}));
const design = source.index.designs.find((d) => d.id === 'S30-O02');
const atlas = strFromU8(source.get(design.svgUrl));
const old = /<g data-caption="[^"]*">[\s\S]*?<\/g>|<g data-component="parks-flag-shape-centre-art">[\s\S]*?<\/g>/g;
const groups = atlas.match(old);
if (groups?.length !== 7) throw new Error(`S30-O02: expected the atlas's 2 captions and 5 flag parts, found ${groups?.length}`);
const first = atlas.indexOf(groups[0]);
const last = atlas.indexOf(groups.at(-1)) + groups.at(-1).length;
const semicircle = atlas.slice(0, first) +
  `<g data-supplied="pofbc-flag-badge" transform="translate(${tx.toFixed(4)} ${ty.toFixed(4)}) scale(${scale.toFixed(6)})">${wordmark}</g>` +
  atlas.slice(last)
    .replace(/<desc>([\s\S]*?)<\/desc>/, (_m, text) => `<desc>${text} Wording and flag: ${DESC}</desc>`);
// The desc sits before the replaced span; apply its note there instead.
const out2 = semicircle.includes('Wording and flag:') ? semicircle
  : semicircle.replace(/<desc>([\s\S]*?)<\/desc>/, (_m, text) => `<desc>${text} Wording and flag: ${DESC}</desc>`);

mkdirSync(join(HERE, 'composed'), { recursive: true });
writeFileSync(join(HERE, 'composed/S30-O01.svg'), square);
writeFileSync(join(HERE, 'composed/S30-O02.svg'), out2);
console.log(`composed/S30-O01.svg ${square.length} bytes, composed/S30-O02.svg ${out2.length} bytes`);
