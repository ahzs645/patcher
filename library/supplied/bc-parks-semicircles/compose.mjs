#!/usr/bin/env node
// Rebuild the BC Parks semicircle patches with exact geometry.
//
//   node library/supplied/bc-parks-semicircles/compose.mjs   (then npm run library:import)
//
// The atlas drew these semicircles freehand: the edge and the coloured field as two separate Bézier
// curves, and the lettering fitted letter by letter along a curve that isn't a circle. Here every
// part is constructed instead:
//
//   - the edge is a true semicircle of radius R on a straight base;
//   - the field is that shape inset by the border width B everywhere: an arc of radius R − B on the
//     same centre, over a base raised by B, meeting at the exact corners (the shape's inner offset);
//   - the upper wording sits on an arc concentric with both, its capitals GAP inside the field's
//     arc, the letters spaced by their own advance widths with even tracking, symmetric about the top;
//   - the lower wording is set on a straight baseline GAP above the field's base, centred;
//   - for the flag patch (S30-O02), PofBC's flag badge wordmark is scaled to the largest box of its
//     proportions that fits inside the field with GAP all round, centred.
//
// The letter outlines, sizes, colours and the overall span of each caption are the atlas's own (the
// three Parks Branch editions use different faces), so only the construction changes.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strFromU8 } from 'fflate';
import { readSnapshot, snapshotPath } from '../../../scripts/atlas-snapshot.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
/** Radius of the semicircle and its border width, in the atlas's master units (its 96-unit-wide patches). */
const R = 48;
/** Clearance between the lettering and the field's edge. */
const GAP = 2.6;
/** Output scale: master units to the SVG's user units, as the atlas files use. */
const SCALE = 5;

const n = (v) => (Math.abs(v) < 1e-9 ? '0' : Number(v.toFixed(4)).toString());
const deg = (rad) => (rad * 180) / Math.PI;

/** The edge and the field: the semicircle, and its exact inset by the border width. */
function base(border, colours) {
  const ri = R - border;
  const x0 = Math.sqrt(ri * ri - border * border);
  return (
    `<path data-component="edge" d="M ${-R} 0 A ${R} ${R} 0 0 1 ${R} 0 Z" fill="${colours.border}"/>` +
    `<path data-component="field" d="M ${n(-x0)} ${-border} A ${ri} ${ri} 0 0 1 ${n(x0)} ${-border} Z" fill="${colours.field}"/>`
  );
}

/** One letter, its baseline centre at (x, y), turned by angle (degrees clockwise). */
const letter = (g, x, y, angle) =>
  `<path d="${g.d}" fill="${g.fill}" transform="translate(${n(x)} ${n(y)})${angle ? ` rotate(${n(angle)})` : ''} ` +
  `scale(${g.s} ${-g.s}) translate(${n(-g.adv / 2)} 0)"/>`;

/**
 * Centre-to-centre distances along the baseline between consecutive letters, before tracking:
 * half of each advance, plus a word space where the caption has one.
 */
function steps(glyphs, spaceAfter) {
  return glyphs.slice(1).map((g, i) => {
    const prev = glyphs[i];
    return (prev.adv / 2 + g.adv / 2) * g.s + (spaceAfter.has(i) ? prev.space * g.s : 0);
  });
}

/** The atlas caption's letters in order, with outline, fill, scale, advance and position. */
function captionGlyphs(svg, name) {
  const group = new RegExp(`<g data-caption="${name}">([\\s\\S]*?)</g>`).exec(svg);
  if (!group) throw new Error(`no caption "${name}"`);
  const glyphs = [...group[1].matchAll(/<path d="([^"]*)" fill="([^"]*)" transform="translate\(([-\d.]+) ([-\d.]+)\) rotate\([-\d.]+\) scale\(([-\d.]+) [-\d.]+\) translate\(([-\d.]+) 0\)"/g)]
    .map((m) => ({ d: m[1], fill: m[2], x: +m[3], y: +m[4], s: +m[5], adv: -2 * +m[6] }));
  // The capitals' height in font units gives the em; a word space is 0.278 em in these faces.
  const em = glyphs[0].adv > 1000 ? 2048 : 1000;
  for (const g of glyphs) g.space = 0.278 * em;
  const letters = name.replace(/ /g, '');
  if (glyphs.length !== letters.length) throw new Error(`"${name}": ${glyphs.length} outlines for ${letters.length} letters`);
  const spaceAfter = new Set();
  let i = -1;
  for (const ch of name) { if (ch === ' ') spaceAfter.add(i); else i += 1; }
  return { glyphs, spaceAfter, capHeight: (em === 2048 ? 1456 : 729) * glyphs[0].s };
}

/** The upper caption on an arc concentric with the semicircle, spanning the atlas's angle. */
function arcCaption({ glyphs, spaceAfter, capHeight }, border, atlasCentre) {
  const radius = R - border - GAP - capHeight;
  // The atlas's span, from its first and last letters about its own centre, made symmetric.
  const angle = (g) => Math.atan2(g.x - atlasCentre.x, atlasCentre.y - g.y);
  const half = (Math.abs(angle(glyphs[0])) + Math.abs(angle(glyphs.at(-1)))) / 2;
  const gaps = steps(glyphs, spaceAfter);
  const tracking = (2 * half * radius - gaps.reduce((a, b) => a + b, 0)) / gaps.length;
  let along = -half * radius;
  return glyphs.map((g, i) => {
    if (i > 0) along += gaps[i - 1] + tracking;
    const theta = along / radius;
    return letter(g, radius * Math.sin(theta), -radius * Math.cos(theta), deg(theta));
  }).join('');
}

/** The lower caption on a straight baseline, centred, as wide as the atlas set it. */
function baseCaption({ glyphs, spaceAfter }, border) {
  const gaps = steps(glyphs, spaceAfter);
  const span = glyphs.at(-1).x - glyphs[0].x;
  const tracking = (span - gaps.reduce((a, b) => a + b, 0)) / gaps.length;
  let x = -span / 2;
  return glyphs.map((g, i) => {
    if (i > 0) x += gaps[i - 1] + tracking;
    return letter(g, x, -(border + GAP), 0);
  }).join('');
}

const document = (title, desc, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${2 * R * SCALE} ${R * SCALE}" role="img">` +
  `<title>${title}</title><desc>${desc}</desc>` +
  `<g transform="translate(${R * SCALE} ${R * SCALE}) scale(${SCALE})" data-construction="semicircle R=${R}">${body}</g></svg>`;

const DESC =
  'Constructed geometry: a true semicircle, its field the exact inset by the border width, the upper wording on a ' +
  'concentric arc and the lower on a straight baseline, both an even clearance inside the field. Letter outlines, ' +
  'colours and caption spans are the atlas reconstruction’s; the typeface and thread colours remain approximate.';

const source = readSnapshot(await snapshotPath({}));
const atlasSvg = (id) => strFromU8(source.get(source.index.designs.find((d) => d.id === id).svgUrl));
const fields = (svg) => [...svg.matchAll(/<g data-component="shared-base-field"><path d="[^"]*" fill="([^"]*)"/g)].map((m) => m[1]);

const out = {};

// The three Parks Branch editions: BRITISH COLUMBIA over PARKS BRANCH. Atlas master: base at y 48.5, centre x 50.
const PARKS_BRANCH_BORDER = 3;
for (const [id, title] of [
  ['S29-O01', 'BC / Parks Branch — beige semicircle'],
  ['S29-O02', 'BC / Parks Branch — yellow semicircle'],
  ['S29-O04', 'BC / Parks Branch — dark semicircle'],
]) {
  const svg = atlasSvg(id);
  const [border, field] = fields(svg);
  out[id] = document(title, DESC,
    base(PARKS_BRANCH_BORDER, { border, field }) +
    `<g data-caption="BRITISH COLUMBIA">${arcCaption(captionGlyphs(svg, 'BRITISH COLUMBIA'), PARKS_BRANCH_BORDER, { x: 50, y: 48.5 })}</g>` +
    `<g data-caption="PARKS BRANCH">${baseCaption(captionGlyphs(svg, 'PARKS BRANCH'), PARKS_BRANCH_BORDER)}</g>`);
}

// S30-O02, the BC Parks flag semicircle: PofBC's flag badge wordmark (frame left out), in the atlas's
// thread colours, fitted inside the field.
{
  const FLAG = join(HERE, '../bc-parks-flag-badge/source/pofbc-flag-badge-ink.svg');
  const THREAD = '#164b47';
  const CLOTH = '#ebeaf4';
  const BORDER = 3.5;
  const badge = readFileSync(FLAG, 'utf8').replace(/#000000/g, THREAD);
  const frame = /<path data-role="frame"[^>]*\/>/.exec(badge)[0];
  const wordmark = badge.slice(badge.indexOf(frame) + frame.length, badge.lastIndexOf('</svg>'));
  // The wordmark's extent in the badge's units, measured in a browser with getBBox.
  const WORDMARK = { x: 56.463, y: 119.407, width: 383.865, height: 257.348 };
  // The largest box of the wordmark's proportions whose top corners stay GAP inside the field's arc:
  // (k·h/2)² + (B + GAP + h)² = (R − B − GAP)², with k its width over height.
  const k = WORDMARK.width / WORDMARK.height;
  const lift = BORDER + GAP;
  const reach = R - BORDER - GAP;
  const a = (k * k) / 4 + 1;
  const h = (-2 * lift + Math.sqrt(4 * lift * lift - 4 * a * (lift * lift - reach * reach))) / (2 * a);
  const scale = h / WORDMARK.height;
  const tx = -(WORDMARK.x + WORDMARK.width / 2) * scale;
  const ty = -lift - (WORDMARK.y + WORDMARK.height) * scale;
  out['S30-O02'] = document('BC Parks flag — semicircle',
    'Constructed geometry: a true semicircle and its field, the exact inset by the border width. Inside it, PofBC’s BC Parks flag badge (its flag and outlined BC / Parks) in the atlas’s thread colours, at the largest size that keeps an even clearance from the field’s edge.',
    base(BORDER, { border: THREAD, field: CLOTH }) +
    `<g data-supplied="pofbc-flag-badge" transform="translate(${n(tx)} ${n(ty)}) scale(${n(scale)})">${wordmark}</g>`);
}

mkdirSync(join(HERE, 'composed'), { recursive: true });
for (const [id, svg] of Object.entries(out)) {
  writeFileSync(join(HERE, `composed/${id}.svg`), svg);
  console.log(`composed/${id}.svg ${svg.length} bytes`);
}
