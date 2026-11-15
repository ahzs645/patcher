#!/usr/bin/env node
// Rebuild the inner emblem of the Forest Fire Prevention Officer shield (S51-O01) from a reviewed
// reconstruction of its photograph, with that review's corrections applied.
//
//   node library/supplied/forest-fire-prevention-shield/compose.mjs   (then npm run library:import)
//
// The atlas drew the oval emblem with the shared historic pine: a thin, symmetrical, open-branched
// tree, where the badge has a broad, solid, tiered and asymmetric conifer (see README.md). It also
// left out the two separator dots. source/reviewed-emblem.svg is a hand-built reconstruction of
// that emblem from a 674 × 676 close-up photograph (source/photograph-674x676.png), and review/ is
// an overlap review of it against the photograph, which listed corrections without applying them.
//
// This script:
//   1. takes the reconstruction's tree, dots and letters, in the photograph's own pixels;
//   2. applies the review's corrections (CORRECTIONS below, each checked to apply exactly once);
//   3. draws the border on the review's fitted ellipse instead of the reconstruction's first guess;
//   4. maps the emblem onto the atlas's inner oval (centre 503, 503; radii 221 × 290 in the atlas's
//      template units): the fitted ellipse is turned upright and scaled onto it;
//   5. replaces the atlas's ring, its BRITISH COLUMBIA and FOREST SERVICE captions and its pine.
//
// The shield, its rims and FOREST FIRE / PREVENTION OFFICER are the atlas's, untouched.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strFromU8 } from 'fflate';
import { readSnapshot, snapshotPath } from '../../../scripts/atlas-snapshot.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ID = 'S51-O01';
const GOLD = '#b69552';

const source = readSnapshot(await snapshotPath({}));
const design = source.index.designs.find((d) => d.id === ID);
const atlas = strFromU8(source.get(design.svgUrl));
const reviewed = readFileSync(join(HERE, 'source/reviewed-emblem.svg'), 'utf8');

/** The reconstruction's element with this id, as written. */
function element (id) {
  const m = new RegExp(`<path id="${id}"[^>]*/>`).exec(reviewed);
  if (!m) throw new Error(`reviewed emblem: no #${id}`);
  return m[0];
}
const attr = (tag, name) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? null;
const squash = (d) => d.replace(/\s+/g, ' ').trim();

// ── The review's corrections, in photograph pixels (review/README.md, review/measurements.json) ──
// Each takes the middle of the review's suggested range.
const CORRECTIONS = [
  {
    finding: 'Lower-left notch: the cut reaches too far right. Tip (325, 402) → about (314, 404.5), 11 px less deep.',
    from: 'C288 423 309 408 325 402 C317 417 303 425 285 430 Q280 431 283 436 C291 444 306 441 320 436',
    // …and with it the small lower-left bough, which sat 3–6 px low: up 4.5 px.
    to: 'C288 423 300 410 314 404.5 C308 419 303 420.5 285 425.5 Q280 426.5 283 431.5 C291 439.5 306 441 320 436'
  },
  {
    finding: 'Upper neck: the right edge after the broad upper bough is pinched by 4–7 px: out 5.5 px.',
    from: 'C378 196 360 189 349 181 C345 177 345 172 346 168 C353 173 359 172 363 168',
    to: 'C378 196 362 189 354.5 181 C350.5 177 350.5 172 351.5 168 C355.5 171 359 172 363 168'
  },
  {
    finding: 'Trunk: the left edge may be 3–6 px too wide (lower confidence): in 3 px, keeping the long trunk and oblique base.',
    from: 'C339 492 338 520 334 541 Q332 548 338 547',
    to: 'C342 492 341 520 337 541 Q335 548 341 547'
  }
];
let conifer = squash(attr(element('conifer'), 'd'));
for (const { finding, from, to } of CORRECTIONS) {
  const count = conifer.split(from).length - 1;
  if (count !== 1) throw new Error(`correction "${finding}" matches ${count} times`);
  conifer = conifer.replace(from, to);
}

// FOREST: the last three letters drift right and their arc is too flat. Review targets (centre,
// angle) for E, S and T.
const LETTER_TARGETS = {
  'bottom-04-E': { at: [237.5, 523.5], angle: 40 },
  'bottom-05-S': { at: [261, 545.5], angle: 32.5 },
  'bottom-06-T': { at: [287, 562], angle: 30 }
};
// Dots: the outline is smaller than the relief (17 × 20 px); review about 22–24 × 28–32, same centres.
const DOT = { rx: 11.5, ry: 15 };
const dot = (cx, cy) => `M${cx - DOT.rx} ${cy} A${DOT.rx} ${DOT.ry} 0 1 0 ${cx + DOT.rx} ${cy} A${DOT.rx} ${DOT.ry} 0 1 0 ${cx - DOT.rx} ${cy} Z`;

function letters (ids) {
  return ids.map((id) => {
    const tag = element(id);
    let transform = attr(tag, 'transform');
    const target = LETTER_TARGETS[id];
    if (target) {
      // Keep the letter's own scale and centring; move and turn it.
      transform = transform
        .replace(/^translate\([^)]*\)/, `translate(${target.at[0]} ${target.at[1]})`)
        .replace(/rotate\([^)]*\)/, `rotate(${target.angle})`);
    }
    return `<path d="${squash(attr(tag, 'd'))}" transform="${transform}"/>`;
  }).join('');
}
const ids = (prefix) => [...reviewed.matchAll(new RegExp(`id="(${prefix}-\\d+-[A-Z])"`, 'g'))].map((m) => m[1]);

// ── The border, on the review's diagnostic fit to the photograph's bright ridge ──
const FIT = JSON.parse(readFileSync(join(HERE, 'review/measurements.json'), 'utf8')).border_diagnostics.fitted_bright_ridge_ellipse;
const RING = 3.5; // half the reconstruction's 7 px ring
// The inner ellipse runs the other way round (sweep 1), so the ring is a ring under either fill rule.
const ellipse = (rx, ry, sweep) => `M${FIT.cx - rx} ${FIT.cy} A${rx} ${ry} 0 1 ${sweep} ${FIT.cx + rx} ${FIT.cy} A${rx} ${ry} 0 1 ${sweep} ${FIT.cx - rx} ${FIT.cy} Z`;
const ring = `<path data-role="border" d="${ellipse(FIT.rx + RING, FIT.ry + RING, 0)} ${ellipse(FIT.rx - RING, FIT.ry - RING, 1)}" fill-rule="evenodd" fill="${GOLD}" transform="rotate(${FIT.rotation_deg} ${FIT.cx} ${FIT.cy})"/>`;

// ── Onto the atlas's oval ──
// The atlas's oval was fitted to the whole badge's photograph, from which its shield and outer
// lettering were drawn; the close-up's oval is a little wider (0.80 against 0.76), likely a
// slightly oblique view. So the fitted ellipse is mapped onto the atlas's exactly: turned upright,
// and scaled 221 / rx across and 290 / ry down.
const ATLAS = { cx: 503, cy: 503, rx: 221, ry: 290 };
const sx = ATLAS.rx / FIT.rx;
const sy = ATLAS.ry / FIT.ry;
const n = (v) => Number(v.toFixed(6));
const placement = `translate(${ATLAS.cx} ${ATLAS.cy}) scale(${n(sx)} ${n(sy)}) rotate(${n(-FIT.rotation_deg)}) translate(${n(-FIT.cx)} ${n(-FIT.cy)})`;

const emblem =
  `<g data-component="forest-service-reviewed-emblem" data-source="supplied/forest-fire-prevention-shield" transform="${placement}" fill="${GOLD}" fill-rule="evenodd">` +
  ring +
  `<path data-component="forest-service-conifer" d="${conifer}"/>` +
  `<path d="${dot(165, 350)}"/><path d="${dot(530, 332)}"/>` +
  `<g data-caption="BRITISH COLUMBIA">${letters(ids('top'))}</g>` +
  `<g data-caption="FOREST SERVICE">${letters(ids('bottom'))}</g>` +
  '</g>';

// ── Replace the atlas's inner emblem ──
const OLD = [
  /<path data-role="border" d="M282 503 A221 290 0 1 0 724 503 A221 290 0 1 0 282 503Z"[^>]*\/>/,
  /<g data-caption="BRITISH COLUMBIA" data-component="elliptical-outlined-caption">[\s\S]*?<\/g>/,
  /<g data-caption="FOREST SERVICE" data-component="elliptical-outlined-caption">[\s\S]*?<\/g>/,
  /<g data-component="historic-pine"[^>]*>[\s\S]*?<\/g>/
];
let svg = atlas;
OLD.forEach((pattern, i) => {
  if (!pattern.test(svg)) throw new Error(`${ID}: atlas element ${i} was not found`);
  svg = svg.replace(pattern, i === 0 ? emblem : '');
});
svg = svg.replace(/<desc>[^<]*<\/desc>/, '<desc>Forest Fire / Prevention Officer shield. The shield, rims and FOREST FIRE / ' +
  'PREVENTION OFFICER lettering are the atlas reconstruction; the inner oval emblem (border, broad asymmetric conifer, ' +
  'separator dots and BRITISH COLUMBIA / FOREST SERVICE) is a hand-built reconstruction of a 674 × 676 close-up ' +
  'photograph, with the corrections of an overlap review applied, fitted onto the atlas’s oval. Exact typeface, die ' +
  'contours and material tones are not established by the photographs.</desc>');

mkdirSync(join(HERE, 'composed'), { recursive: true });
writeFileSync(join(HERE, `composed/${ID}.svg`), svg);
console.log(`composed/${ID}.svg: ${svg.length} bytes`);
