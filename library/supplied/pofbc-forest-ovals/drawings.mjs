#!/usr/bin/env node
// Copy PofBC's drawn green-and-gold Forest Service oval (src/internal/) in its colourways.
//
//   node library/supplied/pofbc-forest-ovals/drawings.mjs [path/to/PofBC]
//
// Two colourways: the drawing as PofBC has it, and one generated after atlas photographs that PofBC
// doesn't offer, marked as such: a light band with green lettering (the cloth patch, decal and
// vehicle door, S46-O01, S24-O04, S42-O01). PofBC's yellow-sky oval was printed on posters, not sewn,
// so it is not copied here; PofBC keeps it in Internal Logos.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const POFBC = process.argv[2] ?? join(HERE, '../../../../PofBC');

const DRAWINGS = {
  'green-gold': {
    source: 'src/internal/forest-service-green-gold.svg',
    variants: {
      colour: {},
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
