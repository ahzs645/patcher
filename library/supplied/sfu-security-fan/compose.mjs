#!/usr/bin/env node
// Build the Simon Fraser University Security Services fan (S56-O48) from the atlas drawing.
//
//   node library/supplied/sfu-security-fan/compose.mjs   (then npm run library:import)
//
// The atlas read this fan as a British Columbia / Motor Vehicles emblem and drew its centre as a few
// coarse polygons. The photograph reads SIMON FRASER UNIVERSITY around the top and SECURITY SERVICES
// along the two lower edges, about the university's arms. Kept from the atlas: the cream fan and its
// navy edge, and the navy thread. Replaced:
//
//   - the centre: Simon Fraser University's full-colour arms, shield and motto scroll, from
//     source/SFU_coat_of_arms_colour.svg (see the README), at the size and place the photograph shows;
//   - the upper caption: SIMON FRASER UNIVERSITY following the fan's own upper edge, an even 1.1 units
//     inside its stroke, in Roboto Condensed Bold;
//   - the lower captions: SECURITY and SERVICES along the two lower edges, where the atlas set MOTOR
//     and VEHICLES, in the same face.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strFromU8 } from 'fflate';
import { readSnapshot, snapshotPath } from '../../../scripts/atlas-snapshot.mjs';
import { along, face, lengthOf, line, offset, sampleQuadratics, trackingFor, width } from '../lettering/lettering.mjs';
import { embed } from '../lettering/embed.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ID = 'S56-O48';
const source = readSnapshot(await snapshotPath({}));
const design = source.index.designs.find((d) => d.id === ID);
const atlas = strFromU8(source.get(design.svgUrl));

// The atlas fan: an upper edge of three quadratic curves over two straight lower edges meeting at (46, 45).
const BORDER = 'M9 27 Q18 8 37 2 Q54 -3 69 10 Q79 18 85 27 L46 45 Z';
const STROKE = 1.9;
if (!atlas.includes(`d="${BORDER}"`)) throw new Error(`${ID}: the atlas border has changed`);
const NAVY = /<path data-role="border" fill="[^"]*" stroke="(#[0-9a-f]{6})"/.exec(atlas)[1];

const rc = face('roboto-condensed-bold');
const GAP = 1.1; // clear of the stroke's inner edge

// SIMON FRASER UNIVERSITY: on the upper edge moved inward by half the stroke, the gap and the cap
// height, from 9 units after the left corner to 9 before the right.
const CAP_TOP = 3.5;
const edge = sampleQuadratics([[[9, 27], [18, 8], [37, 2]], [[37, 2], [54, -3], [69, 10]], [[69, 10], [79, 18], [85, 27]]]);
const baseline = offset(edge, STROKE / 2 + GAP + CAP_TOP);
const INSET = 9;
const topText = 'SIMON FRASER UNIVERSITY';
const topLength = lengthOf(baseline) - 2 * INSET;
const upper = along(rc, topText, {
  points: baseline,
  capHeight: CAP_TOP,
  fill: NAVY,
  tracking: trackingFor(rc, topText, CAP_TOP, topLength),
  centre: INSET + topLength / 2,
});

// SECURITY and SERVICES: each on a line parallel to its lower edge, inward by half the stroke and the
// gap, centred between the corner and the bottom point with 5 units clear of each end.
const CAP_LOW = 3.4;
function edgeLine(text, [ax, ay], [bx, by]) {
  const len = Math.hypot(bx - ax, by - ay);
  const ux = (bx - ax) / len;
  const uy = (by - ay) / len;
  // Inward is to the left of travel from the corner to the bottom point on the left edge, and from
  // the bottom point to the corner on the right edge: (uy, −ux) in y-down axes.
  const d = STROKE / 2 + GAP;
  const mx = (ax + bx) / 2 + uy * d;
  const my = (ay + by) / 2 - ux * d;
  const room = len - 10;
  const tracking = Math.min(0.6, trackingFor(rc, text, CAP_LOW, room));
  if (width(rc, text, CAP_LOW, { tracking }) > room) throw new Error(`${ID}: ${text} does not fit its edge`);
  return line(rc, text, { x: mx, y: my, capHeight: CAP_LOW, fill: NAVY, tracking, rotate: (Math.atan2(uy, ux) * 180) / Math.PI });
}
const lowerLeft = edgeLine('SECURITY', [9, 27], [46, 45]);
const lowerRight = edgeLine('SERVICES', [46, 45], [85, 27]);

// The arms: shield and scroll, centred on the fan's axis, from just under the upper caption to clear
// of the lower captions, as the photograph places them (about 9 to 32 units down).
const arms = embed(readFileSync(join(HERE, 'source/SFU_coat_of_arms_colour.svg'), 'utf8'), {
  x: 46.8 - 15, y: 8.8, width: 30, height: 23.2, prefix: 'sfu-arms',
  attrs: 'data-component="sfu-arms" data-source="supplied/sfu-security-fan/source/SFU_coat_of_arms_colour.svg"',
});

const border = /<path data-role="border"[^>]*\/>/.exec(atlas)[0];
const open = /^[\s\S]*?<svg\b[^>]*>/.exec(atlas)[0];
const svg =
  open +
  '<title>Simon Fraser University / Security Services — fan</title>' +
  '<desc>Cream fan with a navy edge. Simon Fraser University’s full-colour arms (shield and motto scroll, from ' +
  'the university’s 2015 brand guidelines) in the centre; SIMON FRASER UNIVERSITY along the upper edge and ' +
  'SECURITY SERVICES along the lower edges, outlined in Roboto Condensed Bold. Interpreted from a 113 × 48 ' +
  'collector-board photograph: the embroidered alphabet, thread colours and the arms’ stitched detail are ' +
  'not verified.</desc>' +
  border + upper + lowerLeft + lowerRight + arms.svg +
  '</svg>';

mkdirSync(join(HERE, 'composed'), { recursive: true });
writeFileSync(join(HERE, `composed/${ID}.svg`), svg);
console.log(`composed/${ID}.svg: ${svg.length} bytes; arms ${arms.box.width.toFixed(1)} × ${arms.box.height.toFixed(1)} at (${arms.box.x.toFixed(1)}, ${arms.box.y.toFixed(1)})`);
