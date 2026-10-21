#!/usr/bin/env node
// Rebuild the notched Division flashes (MC09-O02 Wildlife Protection, MC13-O02 Predator Control)
// as two shapes merged: the regular two-line felt flash's curved rocker (moosecop-early-two-line-
// flash-v1, as MC09-O01 and MC12-O01) with a box joined under its centre for DIVISION.
//
//   node library/supplied/moosecop-division-flash/compose.mjs   (then npm run library:import)
//
// The atlas drew the pair as one freehand outline with notched shoulders. Here the outline is the
// union of the two shapes, worked out exactly: the rocker's arc down to where its inner curve meets
// the box's sides, then round the box. The gold inset is the same union of the rocker's inset and
// the box's. Lettering and colours are the atlas's.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strFromU8 } from 'fflate';
import { readSnapshot, snapshotPath } from '../../../scripts/atlas-snapshot.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

// The regular rocker, in the flash master's 100-unit frame (MC09-O01's shared-base-border and
// shared-inset-border): outer arc from (x0, y0) over control (50, top) to (100 - x0, y0), then
// down to the inner arc's ends (xi, yi), whose control is (50, under).
const ROCKER = { x0: 2, y0: 25, top: -22, xi: 86, yi: 43, under: 9 };
const INSET = { x0: 7, y0: 25, top: -15, xi: 85, yi: 38, under: 8 };
// The box under the centre: the atlas's own (x 23–77 to y 37, its inset 26–74 to y 32), dropped
// to sit as deep as the rocker's ends.
const BOX = { left: 23, bottom: 40 };
const BOX_INSET = { left: 26, bottom: 36 };

const f = (n) => +n.toFixed(3);
// The inner arc runs from (xi, yi) to (100 - xi, yi). Split it where it meets x = 100 - left (the
// box's right side), by solving x(t) for t, and keep the piece from the right end to there.
function union (r, box) {
  const P0 = [r.xi, r.yi];
  const P1 = [50, r.under];
  const P2 = [100 - r.xi, r.yi];
  // x(t) = P0 + 2t(P1 - P0) + t²(P0 - 2P1 + P2); a quadratic in t for x = 100 - left.
  const a = P0[0] - 2 * P1[0] + P2[0];
  const b = 2 * (P1[0] - P0[0]);
  const c = P0[0] - (100 - box.left);
  const t = a === 0 ? -c / b : (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
  const lerp = (p, q, s) => [p[0] + (q[0] - p[0]) * s, p[1] + (q[1] - p[1]) * s];
  const Q1 = lerp(P0, P1, t); // control point of the piece [0, t]
  const hit = lerp(Q1, lerp(P1, P2, t), t);
  const mirror = ([x, y]) => [100 - x, y];
  const [cx, cy] = Q1;
  const [hx, hy] = hit;
  if (hy > box.bottom) throw new Error('the box must reach below the inner arc');
  return `M${r.x0} ${r.y0} Q50 ${r.top} ${100 - r.x0} ${r.y0} L${r.xi} ${r.yi} ` +
    `Q${f(cx)} ${f(cy)} ${f(hx)} ${f(hy)} V${box.bottom} H${box.left} V${f(hy)} ` +
    `Q${f(mirror(Q1)[0])} ${f(cy)} ${100 - r.xi} ${r.yi} Z`;
}
const OUTER = union(ROCKER, BOX);
const INNER = union(INSET, BOX_INSET);
const BOTTOM = Math.max(ROCKER.yi, BOX.bottom) + 1;

const source = readSnapshot(await snapshotPath({}));
mkdirSync(join(HERE, 'composed'), { recursive: true });
for (const id of ['MC09-O02', 'MC13-O02']) {
  const design = source.index.designs.find((d) => d.id === id);
  let svg = strFromU8(source.get(design.svgUrl));
  const scale = +/scale\(([\d.]+)\)" data-master-id="moosecop-division-notch-flash-v1"/.exec(svg)[1];
  svg = svg
    .replace(/(<path d=")[^"]*(" fill="[^"]*" data-component="shared-base-border")/, `$1${OUTER}$2`)
    .replace(/(<path d=")[^"]*(" fill="none"[^>]*data-component="shared-inset-border")/, `$1${INNER}$2`)
    // The rocker's ends hang lower than the notched outline did: deepen the canvas to match.
    .replace(/viewBox="0 0 (\d+) (\d+)"/, (_m, w) => `viewBox="0 0 ${w} ${Math.ceil(BOTTOM * scale)}"`);
  if (!svg.includes(OUTER) || !svg.includes(INNER)) throw new Error(`${id}: outline not replaced`);
  writeFileSync(join(HERE, `composed/${id}.svg`), svg);
  console.log(`composed/${id}.svg: ${svg.length} bytes`);
}
