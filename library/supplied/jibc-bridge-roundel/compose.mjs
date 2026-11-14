#!/usr/bin/env node
// Build the Justice Institute bridge roundel (S56-O36) with the Institute's own monogram in its centre,
// in place of the atlas's schematic bridge.
//
//   node library/supplied/jibc-bridge-roundel/compose.mjs   (then npm run library:import)
//
// The gold ring, the navy disc and the BRITISH COLUMBIA lettering are the atlas's reconstruction. Its
// centre art, a single stroked path of five lines, gives way to the four paths of the JIBC monogram
// (the triangle with B and C) from the supplied fan-badge package (../jibc-fan-badge), in the
// roundel's gold thread, centred where the bridge sat. The upper caption, JUSTICE INSTITUTE, which the
// atlas left out, is set over the top of the ring in the atlas's own face and size (Roboto Condensed
// Bold, cap height 6.6, its navy), mirroring BRITISH COLUMBIA below: the capitals fill the same band
// of the ring, from radius 34.4 to 41.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strFromU8 } from 'fflate';
import { readSnapshot, snapshotPath } from '../../../scripts/atlas-snapshot.mjs';
import { arc, face } from '../lettering/lettering.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const source = readSnapshot(await snapshotPath({}));
const design = source.index.designs.find((d) => d.id === 'S56-O36');
const atlas = strFromU8(source.get(design.svgUrl));

// The atlas's bridge: one stroked path, the last thing drawn.
const BRIDGE = /<path d="M23 59L52 35L79 57[^"]*"[^>]*\/>/;
if (!BRIDGE.test(atlas)) throw new Error('S56-O36: the atlas bridge path was not found');
const GOLD = /<path d="M23 59[^>]*stroke="(#[0-9a-f]{6})"/.exec(atlas)[1];

// The monogram's four paths and the box they fill, in the package's own units.
const monogram = readFileSync(join(HERE, '../jibc-fan-badge/vectors/JIBC_Monogram.svg'), 'utf8');
const paths = [...monogram.matchAll(/<path\b[^>]*\/>/g)].map(([tag]) => tag);
if (paths.length !== 4) throw new Error(`S56-O36: expected 4 monogram paths, found ${paths.length}`);
const box = { left: 353.5, top: 312.8, right: 1085.4, bottom: 627.8 };

// Inside the navy disc (r 31 about 50, 50): 52 units wide (as wide as the photograph shows it), centred on the bridge's own middle.
const WIDTH = 52;
const scale = WIDTH / (box.right - box.left);
const cx = 50;
const cy = 47.5;
const tx = cx - ((box.left + box.right) / 2) * scale;
const ty = cy - ((box.top + box.bottom) / 2) * scale;
const art =
  `<g data-component="specialty-centre-art" data-source="JIBC monogram, supplied/jibc-fan-badge" ` +
  `transform="translate(${tx.toFixed(4)} ${ty.toFixed(4)}) scale(${scale.toFixed(6)})">` +
  paths.map((tag) => tag.replace(/\s*id="[^"]*"/, '').replace(/fill="#[0-9A-Fa-f]{6}"/, `fill="${GOLD}"`).replace(/\s*\/>$/, '/>')).join('') +
  '</g>';

// JUSTICE INSTITUTE over the top. BRITISH COLUMBIA's baseline is the circle of radius 41 below the
// centre, its capitals standing inward to 34.4; these stand outward from 34.4 to 41.
const NAVY = /<g data-caption="BRITISH COLUMBIA"><path d="[^"]*" fill="(#[0-9a-f]{6})"/.exec(atlas)[1];
const CAP = 6.6;
const upper = arc(face('roboto-condensed-bold'), 'JUSTICE INSTITUTE', {
  cx: 50, cy: 50, radius: 41 - CAP, capHeight: CAP, fill: NAVY, tracking: 0.3, side: 'top',
});

const svg = atlas
  .replace(BRIDGE, art + upper)
  .replace(/<title>[^<]*<\/title>/, '<title>Justice Institute / British Columbia — gold and navy roundel</title>')
  .replace(/<desc>[^<]*<\/desc>/, '<desc>Gold ring and navy disc with the Justice Institute of British Columbia monogram. ' +
    'JUSTICE INSTITUTE over the top and BRITISH COLUMBIA below, outlined in Roboto Condensed Bold; the embroidered ' +
    'alphabet, thread colours and fine detail are interpreted from a low-resolution collector board.</desc>');
mkdirSync(join(HERE, 'composed'), { recursive: true });
writeFileSync(join(HERE, 'composed/S56-O36.svg'), svg);
console.log(`composed/S56-O36.svg: ${svg.length} bytes`);
