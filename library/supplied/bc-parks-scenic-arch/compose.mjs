#!/usr/bin/env node
// Put the supplied BC Parks landscape (vectors/bc-parks-scene-editable.svg) into the atlas's scenic
// arch, both variants: "Parks" (S30-O04) and "Parks · Ranger" (S27-O04). The arch, its lettering and
// the RANGER band stay the atlas's; only the picture inside the window is replaced.
//
//   node library/supplied/bc-parks-scenic-arch/compose.mjs   (then npm run library:import)
//
// The scene's opening (its own clip path, x 144–949, y 244–1071) is fitted to the window's bounds
// as a nested <svg>, and the atlas's window clip still bounds it, so the white frame and lettering
// around it don't move. Both outputs carry the same scene bytes, which the import stores once.

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

const scene = readFileSync(join(HERE, 'vectors/bc-parks-scene-editable.svg'), 'utf8');
// The scene's content, without its XML declaration, root element, title or description.
const inner = scene
  .replace(/^[\s\S]*?<svg\b[^>]*>/, '')
  .replace(/<\/svg>\s*$/, '')
  .replace(/<title>[\s\S]*?<\/title>|<desc>[\s\S]*?<\/desc>/g, '')
  .trim();

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
  const out = atlas
    .replace(group, (_m, open, _old, close) => `${open}${nested}${close}`)
    .replace(/<desc>([\s\S]*?)<\/desc>/, (_m, text) => `<desc>${text} Landscape: the supplied BC Parks scene vector package (reference-fit editable scene), fitted to the window.</desc>`);
  writeFileSync(join(HERE, 'composed', `${id}.svg`), out);
  console.log(`composed/${id}.svg  ${out.length} bytes`);
}
