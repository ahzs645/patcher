#!/usr/bin/env node
// Restore the two existing ridge/base strokes omitted from the mono Wildfire Management capture.
// No browser, tracing, rescaling or new geometry: black.svg already carries the same tree scene,
// with exactly these two paths between its white mountain field and foreground evergreen.
//
//   node library/supplied/pofbc-forest-ovals/repair-mono-mountains.mjs
//   node library/supplied/pofbc-forest-ovals/repair-mono-mountains.mjs --check
//
// The capture now adds the same primitives for future mono Wildfire Management captures. This
// bounded repair preserves every byte outside the matching scene and refuses a changed source,
// transform, non-mountain path, partial repair or ambiguous scene instead of guessing placement.
// R20-O01's 211 × 238 pixel reference shows the missing mountain bands. This restores their existing
// vector strokes only; it does not establish the photographed tone/fill, exact oval proportions,
// lettering, tree silhouette or small background-tree details.

import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MOUNTAIN = /<path\b(?=[^>]*\bdata-primitive="mountain-line")[^>]*\/>/g;

function treeScene(svg, label) {
  // These captures have one primitive, one transformed group, and path children only. Refuse a
  // different hierarchy rather than applying a textual repair to an unfamiliar SVG structure.
  const pattern = /(<g\b(?=[^>]*\bdata-primitive="scene-tree")[^>]*>)(\s*<g\b[^>]*>)(\s*(?:<path\b[^>]*\/>\s*)+)<\/g>\s*<\/g>/g;
  const matches = [...svg.matchAll(pattern)];
  assert.equal(matches.length, 1, `${label}: expected one path-only tree scene`);
  const match = matches[0];
  return {
    outer: match[1].replace(/\s+id="[^"]*"/, ''),
    frame: match[2],
    paths: match[3],
    start: match.index + match[1].length + match[2].length,
  };
}

export function repairMonoMountains(reference, target) {
  const source = treeScene(reference, 'black.svg');
  const current = treeScene(target, 'wildfire-management-black.svg');
  assert.equal(current.outer, source.outer, 'Tree scene wrappers differ');
  assert.equal(current.frame, source.frame, 'Tree scene transforms differ');
  const lines = [...source.paths.matchAll(MOUNTAIN)].map((match) => match[0]);
  assert.equal(lines.length, 2, 'black.svg must contain exactly the ridge and base strokes');
  for (const line of lines) {
    assert.match(line, /fill="none"/, 'Mountain line must be an unfilled stroke');
    assert.match(line, /stroke="#000000"/, 'Expected the existing black mountain strokes');
  }
  const withoutMountains = source.paths.replace(MOUNTAIN, '');
  if (current.paths === source.paths) return target; // Already repaired, byte for byte.
  assert.equal([...current.paths.matchAll(MOUNTAIN)].length, 0, 'Target contains a partial or different repair');
  assert.equal(current.paths, withoutMountains, 'Non-mountain tree-scene content differs');
  return target.slice(0, current.start) + source.paths + target.slice(current.start + current.paths.length);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.ok(process.argv.slice(2).every((arg) => arg === '--check'), 'Only --check is supported');
  const reference = readFileSync(join(HERE, 'forest-service/black.svg'), 'utf8');
  const targetFile = join(HERE, 'forest-service/wildfire-management-black.svg');
  const target = readFileSync(targetFile, 'utf8');
  const repaired = repairMonoMountains(reference, target);
  if (process.argv.includes('--check')) {
    assert.equal(target, repaired, 'Mono Wildfire Management is missing its existing mountain strokes');
    console.log('Mono Wildfire Management mountain strokes match black.svg.');
  } else if (target !== repaired) {
    writeFileSync(targetFile, repaired);
    console.log('Restored the existing ridge/base paths; all other SVG bytes preserved.');
  } else {
    console.log('Mono Wildfire Management already has the matching mountain strokes.');
  }
}
