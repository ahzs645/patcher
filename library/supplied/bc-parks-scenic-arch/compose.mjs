#!/usr/bin/env node
// Put the supplied BC Parks landscape (vectors/bc-parks-scene-editable.svg) into the atlas's scenic
// arch, both variants: "Parks" (S30-O04) and "Parks · Ranger" (S27-O04). The arch, its lettering and
// the RANGER band stay the atlas's; only the picture inside the window is replaced.
//
//   node library/supplied/bc-parks-scenic-arch/compose.mjs   (then npm run library:import)
//
// The scene's opening (its own clip path, x 144–949, y 244–1071) is fitted to the window's bounds
// as a nested <svg>, so the lettering around it doesn't move. The window itself takes the opening's
// outline: the atlas draws it with a square step at the shoulders, where the scene (and the patch)
// flares out in a curve, and the two together left a wedge of white panel showing in each shoulder
// instead of an even white frame. Both outputs carry the same scene bytes, which the import stores
// once.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strFromU8 } from 'fflate';
import { readSnapshot, snapshotPath } from '../../../scripts/atlas-snapshot.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OPENING = { x: 144, y: 244, width: 805, height: 827 };

/** The atlas master's window, in its own units: x 16–85, y 19 to the bottom, stretched by the master's y scale. */
const VARIANTS = [
  { id: 'S30-O04', bottom: 80, yScale: 1.16 },
  { id: 'S27-O04', bottom: 73, yScale: 1.28 },
];

/**
 * The scene's opening (scene-opening-geometry in the supplied vector), as absolute segments in the
 * scene's own units. Kept here in a form that can be mapped; compose fails if the vector's differs.
 */
const OPENING_D = 'M 244,548 C 244,380 380,244 548,244 C 715,244 849,380 849,548 L 849,678 C 849,727 880,749 949,749 L 949,1065 Q 949,1071 943,1071 H 150 Q 144,1071 144,1065 V 749 C 213,749 244,728 244,680 Z';
const OPENING_SEGMENTS = [
  ['M', 244, 548], ['C', 244, 380, 380, 244, 548, 244], ['C', 715, 244, 849, 380, 849, 548], ['L', 849, 678],
  ['C', 849, 727, 880, 749, 949, 749], ['L', 949, 1065], ['Q', 949, 1071, 943, 1071], ['L', 150, 1071],
  ['Q', 144, 1071, 144, 1065], ['L', 144, 749], ['C', 213, 749, 244, 728, 244, 680], ['Z'],
];
/** The atlas master's window: a square step at each shoulder. */
const ATLAS_WINDOW = /M16 (\d+)V53H24V45C24 29 34 19 50 19C66 19 77 29 77 45V53H85V\1Z/g;

/** The window's outline stroke, drawn over the scene. */
const OUTLINE = /(fill="none" stroke="#f1eef0" )stroke-width="1\.1"(?= stroke-linejoin="round" stroke-linecap="round" transform="scale\(1\.0 1\.\d+\)")/;

/** The opening in the atlas master's units (before the master's y scale), for a window ending at `bottom`. */
function windowPath(bottom) {
  const n = (v) => String(+v.toFixed(3));
  const x = (v) => n(16 + ((v - OPENING.x) / OPENING.width) * 69);
  const y = (v) => n(19 + ((v - OPENING.y) / OPENING.height) * (bottom - 19));
  return OPENING_SEGMENTS.map(([cmd, ...c]) => cmd + c.map((v, i) => (i % 2 ? y(v) : x(v))).join(' ')).join('');
}

const scene = readFileSync(join(HERE, 'vectors/bc-parks-scene-editable.svg'), 'utf8');
// The scene's content, without its XML declaration, root element, title or description.
const inner = scene
  .replace(/^[\s\S]*?<svg\b[^>]*>/, '')
  .replace(/<\/svg>\s*$/, '')
  .replace(/<title>[\s\S]*?<\/title>|<desc>[\s\S]*?<\/desc>/g, '')
  .trim();
const drawn = /id="scene-opening-geometry" d="([^"]*)"/.exec(scene)?.[1].replace(/&#10;|\s+/g, ' ').replace(/ +/g, ' ').trim();
if (drawn !== OPENING_D) throw new Error('The scene\'s opening has changed: update OPENING_D and OPENING_SEGMENTS to match it.');

const source = readSnapshot(await snapshotPath({}));
mkdirSync(join(HERE, 'composed'), { recursive: true });
for (const { id, bottom, yScale } of VARIANTS) {
  const design = source.index.designs.find((d) => d.id === id);
  const atlas = strFromU8(source.get(design.svgUrl));
  const group = /(<g clip-path="url\(#parks-scenic-window\)">)([\s\S]*?)(<\/g>)/;
  if (!group.test(atlas)) throw new Error(`${id}: no scenic window group`);
  const y = 19 * yScale;
  const height = (bottom - 19) * yScale;
  const nested =
    `<svg xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" data-supplied="bc-parks-scene-editable" ` +
    `x="16" y="${y.toFixed(3)}" width="69" height="${height.toFixed(3)}" ` +
    `viewBox="${OPENING.x} ${OPENING.y} ${OPENING.width} ${OPENING.height}" preserveAspectRatio="none">${inner}</svg>`;
  if ((atlas.match(ATLAS_WINDOW) ?? []).length !== 3) throw new Error(`${id}: expected the window's panel, clip and outline`);
  if (!OUTLINE.test(atlas)) throw new Error(`${id}: no window outline`);
  const out = atlas
    .replace(ATLAS_WINDOW, windowPath(bottom))
    // The outline is now the whole frame (it no longer sits on a wider white panel), so it takes
    // the frame's weight in the scan: about 2% of the patch's width.
    .replace(OUTLINE, (_m, before) => `${before}stroke-width="1.9"`)
    .replace(group, (_m, open, _old, close) => `${open}${nested}${close}`)
    .replace(/<desc>([\s\S]*?)<\/desc>/, (_m, text) => `<desc>${text} Landscape: the supplied BC Parks scene vector package (reference-fit editable scene), fitted to the window; the window's panel, clip and white outline follow the scene's opening.</desc>`);
  writeFileSync(join(HERE, 'composed', `${id}.svg`), out);
  console.log(`composed/${id}.svg  ${out.length} bytes`);
}
