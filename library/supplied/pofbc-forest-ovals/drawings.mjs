#!/usr/bin/env node
// Copy PofBC's two drawn Forest Service ovals (src/internal/) in their colourways.
//
//   node library/supplied/pofbc-forest-ovals/drawings.mjs [path/to/PofBC]
//
// The colourways are PofBC's own (src/internal/forestLogos.js, DRAWING_VARIANTS: maps from the
// drawing's colours to new ones), plus two generated after atlas photographs that PofBC doesn't
// offer, marked as such: the yellow-sky oval with a dark ring and cream lettering (the poster
// oval, atlas S04-O01), and the green-and-gold oval with a light band and green lettering (the
// cloth patch, decal and vehicle door, S46-O01, S24-O04, S42-O01).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const POFBC = process.argv[2] ?? join(HERE, '../../../../PofBC');

const YELLOW_SKY_CREAM = { '#12763A': '#CCC98B', '#F4DD04': '#F0D17B', '#F4F0D3': '#F5EBC4', '#DEE6C5': '#CBD5B9', '#0B3024': '#282E1B', '#18553A': '#235950', '#2C7252': '#3E7C6D', '#0D3527': '#163E37', '#19392A': '#333D2A', '#1B5841': '#25594E' };

const DRAWINGS = {
  'yellow-sky': {
    source: 'src/internal/forest-service-yellow-sky.svg',
    variants: {
      colour: {},
      cream: { recolour: YELLOW_SKY_CREAM },
      // Generated: the ring dark and the lettering and dots cream, after the poster oval (S04-O01).
      dark: { recolour: { '#12763A': '#211823', '#F4DD04': '#EFBE39' }, byId: { 'lettering-upper': '#EBD29F', 'lettering-lower': '#EBD29F', 'left-separator': '#EBD29F', 'right-separator': '#EBD29F' } },
    },
  },
  'green-gold': {
    source: 'src/internal/forest-service-green-gold.svg',
    variants: {
      colour: {},
      'black-gold': { recolour: { '#00381E': '#000000' } },
      black: { recolour: { '#00381E': '#000000', '#080C0A': '#000000', '#E6C786': '#FFFFFF', '#005737': '#FFFFFF', '#0FB4E0': '#FFFFFF', '#8D8F8D': '#FFFFFF' } },
      // Generated: a light band with green rules and lettering, after S46-O01, S24-O04 and S42-O01.
      'light-band': { recolour: { '#00381E': '#EEEADE', '#E6C786': '#164E3E' } },
    },
  },
};

/** Map every listed colour at once, so one replacement never feeds another. */
function recolour(svg, map = {}) {
  const lower = Object.fromEntries(Object.entries(map).map(([from, to]) => [from.toLowerCase(), to]));
  return svg.replace(/#[0-9a-f]{6}\b/gi, (hex) => lower[hex.toLowerCase()] ?? hex);
}

/** Give the elements with these ids a new fill (their own or their group's). */
function fillById(svg, map = {}) {
  let out = svg;
  for (const [id, fill] of Object.entries(map)) {
    const tag = new RegExp(`(<[\\w:]+\\b[^>]*\\bid="${id}"[^>]*?\\bfill=")#[0-9a-fA-F]{6}(")`);
    if (!tag.test(out)) throw new Error(`no element #${id} with a fill`);
    out = out.replace(tag, `$1${fill}$2`);
  }
  return out;
}

for (const [name, { source, variants }] of Object.entries(DRAWINGS)) {
  const svg = readFileSync(join(POFBC, source), 'utf8');
  mkdirSync(join(HERE, name), { recursive: true });
  for (const [variant, { recolour: map, byId }] of Object.entries(variants)) {
    const out = fillById(recolour(svg, map), byId);
    writeFileSync(join(HERE, name, `${variant}.svg`), out);
    console.log(`${name}/${variant}.svg  ${out.length} bytes`);
  }
}
