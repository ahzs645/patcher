// Outlined lettering for composed patches, set the way the atlas sets its own: one <path> per letter,
// in font units, placed with translate(x y) rotate(a) scale(s −s) translate(−advance/2 0) about the
// middle of its baseline, the line grouped under <g data-caption="…"> so the digitizer sews it raised.
//
//   import { face, line, arc, width } from '../lettering/lettering.mjs';
//   const rc = face('roboto-condensed-bold');
//   arc(rc, 'JUSTICE INSTITUTE', { cx: 50, cy: 50, radius: 34.4, capHeight: 6.6, fill: '#253452' });
//
// Sizes are given as cap heights in the drawing's units. Tracking is extra space between letters, in
// the same units. Faces live in glyphs/ (build-glyphs.mjs makes them).

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const n = (v) => (Math.abs(v) < 5e-6 ? '0' : Number(v.toFixed(5)).toString());

/** A face from glyphs/<name>.json. */
export function face(name) {
  return JSON.parse(readFileSync(join(HERE, 'glyphs', `${name}.json`), 'utf8'));
}

/** Font units to drawing units for letters of the given cap height. */
const unit = (f, capHeight) => capHeight / f.capHeight;

/** The letters of a text with their advances (drawing units); spaces are kept as gaps. */
function run(f, text, capHeight, { tracking = 0, wordSpace = 1 } = {}) {
  const s = unit(f, capHeight);
  const items = [];
  for (const ch of text) {
    if (ch === ' ') { items.push({ space: f.space * s * wordSpace }); continue; }
    const g = f.glyphs[ch];
    if (!g) throw new Error(`${f.font} has no outline for "${ch}"`);
    items.push({ ch, g, adv: g.adv * s });
  }
  // Centre of each letter along the baseline, from the start of the line.
  let along = 0;
  let first = true;
  const letters = [];
  for (const it of items) {
    if (it.space !== undefined) { along += it.space; continue; }
    if (!first) along += tracking;
    letters.push({ ...it, centre: along + it.adv / 2 });
    along += it.adv;
    first = false;
  }
  return { letters, length: along, s };
}

/** How long a line is, from the start of its first letter to the end of its last. */
export const width = (f, text, capHeight, opts) => run(f, text, capHeight, opts).length;

/** The tracking that makes a line exactly `length` long. */
export function trackingFor(f, text, capHeight, length, opts = {}) {
  const { letters, length: natural } = run(f, text, capHeight, { ...opts, tracking: 0 });
  return (length - natural) / Math.max(1, letters.length - 1);
}

const letterPath = (l, s, x, y, angle, fill, sx = 1) =>
  `<path d="${l.g.d}" fill="${fill}" transform="translate(${n(x)} ${n(y)}) rotate(${n(angle)}) ` +
  `scale(${n(s * sx)} ${n(-s)}) translate(${n(-l.g.adv / 2)} 0)"/>`;

const group = (text, body) => `<g data-caption="${text}">${body}</g>`;

/**
 * A straight line of letters, centred on (x, y) (its baseline), turned by `rotate` degrees clockwise.
 * `stretch` scales the letters horizontally (below 1 condenses them).
 */
export function line(f, text, { x, y, capHeight, fill, tracking = 0, rotate = 0, stretch = 1, wordSpace = 1 }) {
  const { letters, length, s } = run(f, text, capHeight, { tracking, wordSpace });
  const a = (rotate * Math.PI) / 180;
  const body = letters.map((l) => {
    const d = (l.centre - length / 2) * stretch;
    return letterPath(l, s, x + d * Math.cos(a), y + d * Math.sin(a), rotate, fill, stretch);
  }).join('');
  return group(text, body);
}

/**
 * Letters along a circle about (cx, cy). The baseline is the circle of `radius`.
 *   side 'top':    reading clockwise over the top, letters standing outward.
 *   side 'bottom': reading left to right under the bottom, letters standing inward.
 * `at` is the angle of the line's middle in degrees from straight up (top) or straight down (bottom),
 * positive to the right.
 */
export function arc(f, text, { cx, cy, radius, capHeight, fill, tracking = 0, side = 'top', at = 0, wordSpace = 1 }) {
  const { letters, length, s } = run(f, text, capHeight, { tracking, wordSpace });
  const mid = (at * Math.PI) / 180;
  const body = letters.map((l) => {
    const t = mid + (l.centre - length / 2) / radius;
    if (side === 'top') return letterPath(l, s, cx + radius * Math.sin(t), cy - radius * Math.cos(t), (t * 180) / Math.PI, fill);
    return letterPath(l, s, cx + radius * Math.sin(t), cy + radius * Math.cos(t), (-t * 180) / Math.PI, fill);
  }).join('');
  return group(text, body);
}

/** A polyline's length and a lookup of the point and direction at any distance along it. */
function walker(points) {
  const segs = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len === 0) continue;
    segs.push({ x0, y0, dx: (x1 - x0) / len, dy: (y1 - y0) / len, start: total, len });
    total += len;
  }
  const at = (d) => {
    const seg = segs.find((s) => d <= s.start + s.len) ?? segs.at(-1);
    const t = d - seg.start;
    return { x: seg.x0 + seg.dx * t, y: seg.y0 + seg.dy * t, angle: Math.atan2(seg.dy, seg.dx) };
  };
  return { total, at };
}

/**
 * Letters along a polyline baseline, read from its first point to its last and standing on its
 * left (in the drawing's y-down axes, the side that is "up" when the line runs to the right).
 * `stretch` scales glyph widths and advances along the curve, preserving cap height.
 * `centre` is the distance along the line of the text's middle (default: the line's middle).
 */
export function along(f, text, { points, capHeight, fill, tracking = 0, centre, wordSpace = 1, stretch = 1 }) {
  const { letters, length, s } = run(f, text, capHeight, { tracking, wordSpace });
  const path = walker(points);
  const mid = centre ?? path.total / 2;
  const body = letters.map((l) => {
    const p = path.at(mid + (l.centre - length / 2) * stretch);
    return letterPath(l, s, p.x, p.y, (p.angle * 180) / Math.PI, fill, stretch);
  }).join('');
  return group(text, body);
}

/** Sample quadratic Bézier segments [[x0,y0],[cx,cy],[x1,y1]] as one polyline. */
export function sampleQuadratics(segments, steps = 48) {
  const out = [];
  segments.forEach(([[x0, y0], [cx, cy], [x1, y1]], k) => {
    for (let i = k === 0 ? 0 : 1; i <= steps; i++) {
      const t = i / steps;
      const u = 1 - t;
      out.push([u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1]);
    }
  });
  return out;
}

/** A polyline moved sideways by `distance`, to its right (positive) or left (negative), point by point. */
export function offset(points, distance) {
  return points.map(([x, y], i) => {
    const [ax, ay] = points[Math.max(0, i - 1)];
    const [bx, by] = points[Math.min(points.length - 1, i + 1)];
    const len = Math.hypot(bx - ax, by - ay);
    // Right of the direction of travel, in y-down axes: (−dy, dx).
    return [x - ((by - ay) / len) * distance, y + ((bx - ax) / len) * distance];
  });
}

/** A polyline's length. */
export const lengthOf = (points) => walker(points).total;

/** The angle (degrees) a line of letters spans on a circle of `radius`. */
export const arcSpan = (f, text, capHeight, radius, opts) => (width(f, text, capHeight, opts) / radius) * (180 / Math.PI);
