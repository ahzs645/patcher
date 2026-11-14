#!/usr/bin/env node
// Write the outline tables in glyphs/ from the fonts they come from.
//
//   node library/supplied/lettering/build-glyphs.mjs <fonts-dir>
//
// Run it from the root of a checkout that has opentype.js installed (PofBC has it), with <fonts-dir> holding the
// three font files below. They are fetched from npm without installing anything:
//
//   npm pack @fontsource/roboto-condensed@5.1.0 @fontsource/poppins@5.1.0
//   (each .tgz's files/ folder holds the .woff files)
//
// and TeX Gyre Heros Regular is PofBC's src/fonts/generated/regular.ttf (scripts/build-fonts.mjs).
//
// Each table keeps the letters the patch captions use, in the font's own units with y pointing up,
// as the atlas's outlined lettering stores them: an outline is drawn with
// scale(s −s) translate(−advance/2 0) about the middle of its baseline.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const dir = process.argv[2];
if (!dir) throw new Error('usage: build-glyphs.mjs <fonts-dir>');
// opentype.js comes from the checkout the script is run from (PofBC has it), not from Patcher.
const opentypeModule = await import(pathToFileURL(createRequire(join(process.cwd(), 'noop.js')).resolve('opentype.js')).href);
const opentype = opentypeModule.parse ? opentypeModule : opentypeModule.default;

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,\'’-&·';

const FACES = [
  {
    name: 'roboto-condensed-bold',
    file: 'roboto-condensed-latin-700-normal.woff',
    font: 'Roboto Condensed Bold (Fontsource @fontsource/roboto-condensed 5.1.0)',
    licence: 'SIL Open Font License 1.1',
    note: "The atlas's bold caption face: its outlined letters are these outlines, coordinate for coordinate.",
  },
  {
    name: 'heros-regular',
    file: 'regular.ttf',
    font: "TeX Gyre Heros Regular (PofBC's src/fonts/generated/regular.ttf)",
    licence: 'GUST Font License',
    note: "The atlas's light caption face (UNIVERSITY, CAMPUS, SECURITY): the same outlines.",
  },
  {
    name: 'poppins-semibold',
    file: 'poppins-latin-600-normal.woff',
    font: 'Poppins SemiBold (Fontsource @fontsource/poppins 5.1.0)',
    licence: 'SIL Open Font License 1.1',
    note: 'A geometric stand-in for the lower-case lettering of the Police College roundel; the original typeface is unidentified.',
  },
];

/** A glyph's outline as SVG path data, in font units, y up, whole units where the font has them. */
function pathData(glyph) {
  const n = (v) => String(Math.round(v * 100) / 100);
  return glyph.path.commands.map((c) => {
    switch (c.type) {
      case 'M': return `M${n(c.x)} ${n(c.y)}`;
      case 'L': return `L${n(c.x)} ${n(c.y)}`;
      case 'Q': return `Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}`;
      case 'C': return `C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}`;
      case 'Z': return 'Z';
      default: throw new Error(`unknown path command ${c.type}`);
    }
  }).join('');
}

for (const face of FACES) {
  const bytes = readFileSync(join(dir, face.file));
  const font = opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const glyphs = {};
  for (const ch of CHARS) {
    const g = font.charToGlyph(ch);
    if (!g || g.index === 0) continue;
    glyphs[ch] = { adv: g.advanceWidth, d: pathData(g) };
  }
  const table = {
    font: face.font,
    licence: face.licence,
    note: face.note,
    unitsPerEm: font.unitsPerEm,
    capHeight: font.tables.os2.sCapHeight,
    xHeight: font.tables.os2.sxHeight,
    space: font.charToGlyph(' ').advanceWidth,
    glyphs,
  };
  writeFileSync(join(HERE, 'glyphs', `${face.name}.json`), `${JSON.stringify(table, null, 1)}\n`);
  console.log(`glyphs/${face.name}.json: ${Object.keys(glyphs).length} glyphs`);
}
