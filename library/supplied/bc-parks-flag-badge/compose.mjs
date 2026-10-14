#!/usr/bin/env node
// Build the BC Parks flag rounded-square patch (S30-O01) from PofBC's flag badge (source/pofbc-flag-badge-ink.svg, see README).
//
//   node library/supplied/bc-parks-flag-badge/compose.mjs   (then npm run library:import)

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

// S30-O02, the semicircle, is constructed from the same badge by ../bc-parks-semicircles/compose.mjs.

mkdirSync(join(HERE, 'composed'), { recursive: true });
writeFileSync(join(HERE, 'composed/S30-O01.svg'), square);
console.log(`composed/S30-O01.svg ${square.length} bytes`);
