#!/usr/bin/env node
// Build the British Columbia Police College roundel (S56-O47) from the atlas drawing, with its wording
// corrected.
//
//   node library/supplied/bc-police-college-roundel/compose.mjs   (then npm run library:import)
//
// The atlas read the lower caption as TRAFFIC OFFICERS and set both captions in capitals. The
// photograph reads, in lower case, "british columbia" over the top and "police college" underneath.
// The cream rim, navy ring, grey disc and the centre figure are the atlas's; both captions are reset
// in lower case (Poppins SemiBold standing in for the unidentified geometric face), in the atlas's
// cream thread, on circles about the roundel's centre: the upper standing outward from the disc,
// the lower standing inward with its descenders towards the rim.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strFromU8 } from 'fflate';
import { readSnapshot, snapshotPath } from '../../../scripts/atlas-snapshot.mjs';
import { arc, face } from '../lettering/lettering.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ID = 'S56-O47';
const source = readSnapshot(await snapshotPath({}));
const design = source.index.designs.find((d) => d.id === ID);
const atlas = strFromU8(source.get(design.svgUrl));

const UPPER = /<g data-caption="BRITISH COLUMBIA">[\s\S]*?<\/g>/;
const LOWER = /<g data-caption="TRAFFIC OFFICERS">[\s\S]*?<\/g>/;
if (!UPPER.test(atlas) || !LOWER.test(atlas)) throw new Error(`${ID}: the atlas captions were not found`);
const CREAM = /<g data-caption="BRITISH COLUMBIA"><path d="[^"]*" fill="(#[0-9a-f]{6})"/.exec(atlas)[1];

// In the atlas's 100-unit master: the roundel is centred on (50, 51); the grey disc reaches radius
// 28–30 and the navy ring 42–43. Letters 7.2 units to the cap line (5.7 to the x-height).
const f = face('poppins-semibold');
const common = { cx: 50, cy: 51, capHeight: 7.2, fill: CREAM };
const upper = arc(f, 'british columbia', { ...common, radius: 32.5, side: 'top', tracking: 0.8 });
const lower = arc(f, 'police college', { ...common, radius: 37.5, side: 'bottom', tracking: 0.6 });

const svg = atlas
  .replace(UPPER, upper)
  .replace(LOWER, lower)
  .replace(/<title>[^<]*<\/title>/, '<title>British Columbia / Police College — blue roundel</title>' +
    '<desc>Cream-rimmed navy roundel with a grey centre disc. The lower-case captions british columbia and ' +
    'police college are outlined in Poppins SemiBold, a stand-in for the unidentified geometric face; the ' +
    'centre figure is the atlas’s coarse interpretation of a 60 × 57 photograph.</desc>');

mkdirSync(join(HERE, 'composed'), { recursive: true });
writeFileSync(join(HERE, `composed/${ID}.svg`), svg);
console.log(`composed/${ID}.svg: ${svg.length} bytes`);
