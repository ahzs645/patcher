#!/usr/bin/env node
// Build the Fire Commissioner patch (S56-O43) on the supplied outer badge shape: the scalloped
// shield of source/bc-fire-commissioner-shape.svg, in place of the atlas's four-arm Maltese cross.
//
//   node library/supplied/fire-commissioner-badge/compose.mjs   (then npm run library:import)
//
// The shape package (source/, see its README) draws the badge's outline only: a gold silhouette and
// a dark inset field, 96 × 100 units about x = 0. compose.mjs fits both into the atlas's 74 × 73
// canvas and keeps the atlas's coat of arms, its three captions and its two thread colours.
// (source/ is the package as supplied, less its comparison sheet's SVG, which embeds the photograph.)

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strFromU8 } from 'fflate';
import { readSnapshot, snapshotPath } from '../../../scripts/atlas-snapshot.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

const source = readSnapshot(await snapshotPath({}));
const design = source.index.designs.find((d) => d.id === 'S56-O43');
const atlas = strFromU8(source.get(design.svgUrl));

const BORDER = /<path data-role="border" fill="(#[0-9a-f]{6})" stroke="(#[0-9a-f]{6})"[^>]*\/>/;
const [border, field, gold] = BORDER.exec(atlas) ?? [];
if (!border) throw new Error('S56-O43: no border path');

const shape = readFileSync(join(HERE, 'source/bc-fire-commissioner-shape.svg'), 'utf8');
const d = (id) => new RegExp(`id="${id}"[^>]*\\sd="([^"]+)"`).exec(shape)[1].replace(/\s+/g, ' ').trim();
// 100 units high to 72 on the canvas, centred on x = 37, half a unit from the top.
const fit = 'translate(37 0.5) scale(0.72)';
const badge =
  `<g data-role="border" data-source="supplied bc-fire-commissioner-shape.svg" transform="${fit}">` +
  `<path d="${d('outer-gold-silhouette')}" fill="${gold}"/><path d="${d('inner-dark-field')}" fill="${field}"/></g>`;

// The badge narrows faster towards its foot than the cross did, so the lower arc of lettering is
// drawn a tenth smaller about its middle and a unit higher, to stay clear of the gold.
const LOWER = '<g data-caption="BRITISH COLUMBIA">';
if (!atlas.includes(LOWER)) throw new Error('S56-O43: no BRITISH COLUMBIA caption');
const svg = atlas
  .replace(border, badge)
  .replace(LOWER, '<g data-caption="BRITISH COLUMBIA" transform="translate(37 63) scale(0.9) translate(-37 -64)">');
mkdirSync(join(HERE, 'composed'), { recursive: true });
writeFileSync(join(HERE, 'composed/S56-O43.svg'), svg);
console.log(`composed/S56-O43.svg: ${svg.length} bytes`);
