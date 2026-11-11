#!/usr/bin/env node
// Batch-convert Melco DesignShop .ofm files to SVG.
//
//   npm run ofm:svg -- <file.ofm | folder | archive.zip>… [-o out-dir] [--no-walks] [--thumbs]
//
// Folders are searched recursively and .zip archives are read in place. Each
// design becomes <name>.svg in the output folder (default ./ofm-svg), with
// --thumbs also writing the PNG thumbnail DesignShop embeds, <name>.thumb.png.
// A summary table is printed at the end; files that fail are reported, not fatal.

import { readFileSync, writeFileSync, mkdirSync, statSync, readdirSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { unzipSync } from 'fflate';
import { readOfm, ofmToSvg } from '../src/import/ofm.ts';

const args = process.argv.slice(2);
let outDir = 'ofm-svg';
let omitWalks = false;
let thumbs = false;
const inputs = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '-o' || a === '--out') outDir = args[++i];
  else if (a === '--no-walks') omitWalks = true;
  else if (a === '--thumbs') thumbs = true;
  else if (a === '-h' || a === '--help') { usage(0); }
  else inputs.push(a);
}
if (!inputs.length) usage(1);

function usage(code) {
  console.log('usage: npm run ofm:svg -- <file.ofm | folder | archive.zip>… [-o out-dir] [--no-walks] [--thumbs]');
  process.exit(code);
}

/** @type {{name: string, bytes: Uint8Array}[]} */
const jobs = [];
function collect(p) {
  const st = statSync(p);
  if (st.isDirectory()) {
    for (const e of readdirSync(p)) collect(join(p, e));
  } else if (/\.ofm$/i.test(p)) {
    jobs.push({ name: basename(p, extname(p)), bytes: readFileSync(p) });
  } else if (/\.zip$/i.test(p)) {
    const files = unzipSync(readFileSync(p), { filter: (f) => /\.ofm$/i.test(f.name) && !/(^|\/)__MACOSX\//.test(f.name) });
    for (const [n, b] of Object.entries(files)) jobs.push({ name: basename(n, extname(n)), bytes: b });
  }
}
for (const p of inputs) collect(resolve(p));
if (!jobs.length) { console.error('No .ofm files found.'); process.exit(1); }

mkdirSync(outDir, { recursive: true });
const used = new Set();
let ok = 0;
for (const job of jobs) {
  let name = job.name;
  for (let n = 2; used.has(name.toLowerCase()); n++) name = `${job.name} (${n})`;
  used.add(name.toLowerCase());
  try {
    const design = readOfm(job.bytes);
    writeFileSync(join(outDir, `${name}.svg`), ofmToSvg(design, { omitWalks }));
    if (thumbs && design.thumbnail) writeFileSync(join(outDir, `${name}.thumb.png`), design.thumbnail);
    const [x0, y0, x1, y1] = design.bounds;
    const kinds = {};
    for (const s of design.shapes) kinds[s.kind] = (kinds[s.kind] ?? 0) + 1;
    const summary = Object.entries(kinds).map(([k, v]) => `${v} ${k}`).join(', ');
    console.log(`✓ ${name}  ${((x1 - x0) / 10).toFixed(1)}×${((y1 - y0) / 10).toFixed(1)} mm  ${summary}`);
    ok++;
  } catch (err) {
    console.log(`✗ ${name}  ${err.message}`);
  }
}
console.log(`\n${ok}/${jobs.length} converted → ${resolve(outDir)}`);
if (ok < jobs.length) process.exitCode = 2;
