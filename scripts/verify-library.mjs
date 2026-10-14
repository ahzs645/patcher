#!/usr/bin/env node
// Check that every library patch joins back into its original SVG, byte for byte.
//
//   npm run library:verify                    # against the SHA-256 in library/manifest.json
//   npm run library:verify -- --source        # and against the atlas snapshot itself
//   npm run library:verify -- --zip atlas.zip #   (a copy you already have)
//
// Each patch is read as stored (library/<org>/<id>.svg), joined with the shared blocks and path
// bundles it names (library/shared/), and hashed. The manifest's sha256 is the atlas's own
// vectorSha256 for that drawing. With the snapshot, the joined bytes are also compared with the
// snapshot's file directly and its vectorSha256 re-read, and every atlas design must be present,
// or left out, merged or absorbed as the manifest records. Supplied drawings are checked against
// their files in library/supplied/.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { joinSvg, unwrapBlock } from '../src/library-join.js';
import { LIBRARY, drawingKey, parseArgs, readSnapshot, snapshotPath } from './atlas-snapshot.mjs';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** Every patch, joined from disk: { id, org, bytes (Buffer), sha256, expected } */
export function joinedPatches(library = LIBRARY) {
  const manifest = JSON.parse(readFileSync(join(library, 'manifest.json'), 'utf8'));
  const blockFiles = new Map(manifest.shared.blocks.map((b) => [b.id, b.file]));
  const blocks = new Map();
  const block = (id) => {
    if (!blocks.has(id)) blocks.set(id, unwrapBlock(id, readFileSync(join(library, blockFiles.get(id)), 'utf8')));
    return blocks.get(id);
  };
  const paths = new Map();
  for (const bundle of manifest.shared.bundles) {
    for (const [id, value] of Object.entries(JSON.parse(readFileSync(join(library, bundle.file), 'utf8')))) paths.set(id, value);
  }
  const out = [];
  for (const org of manifest.orgs) {
    for (const patch of org.patches) {
      const stored = readFileSync(join(library, patch.svg), 'utf8');
      const bytes = Buffer.from(joinSvg(stored, { block, path: (id) => paths.get(id) }), 'utf8');
      out.push({ id: patch.id, org: org.id, bytes, sha256: sha(bytes), expected: patch.sha256, expectedBytes: patch.bytes, replaced: patch.replaced ?? null, supplied: patch.supplied ?? null });
    }
  }
  return { manifest, patches: out };
}

/**
 * @param {{ source?: { index: object, get: (url: string) => Uint8Array | null } }} [opts]
 * @returns {string[]} what is wrong, empty when everything matches
 */
export function verifyLibrary({ source, library = LIBRARY } = {}) {
  const problems = [];
  const { patches } = joinedPatches(library);
  for (const p of patches) {
    if (p.sha256 !== p.expected) problems.push(`${p.id}: joined SHA-256 ${p.sha256} is not the manifest's ${p.expected}`);
    if (p.bytes.length !== p.expectedBytes) problems.push(`${p.id}: joined ${p.bytes.length} bytes, manifest says ${p.expectedBytes}`);
    // A consolidated variant is drawn by its supplied file, not by an atlas design.
    if (p.supplied && !readFileSync(join(library, p.supplied.svg)).equals(p.bytes)) problems.push(`${p.id}: joined bytes differ from the supplied ${p.supplied.svg}`);
  }
  if (source) {
    const byId = new Map(patches.map((p) => [p.id, p]));
    const { manifest } = joinedPatches(library);
    const excluded = new Set((manifest.excluded ?? []).map((e) => e.id));
    const mergedInto = new Map((manifest.merged ?? []).map((m) => [m.id, m.into]));
    const absorbedInto = new Map((manifest.absorbed ?? []).map((a) => [a.id, a.into]));
    for (const design of source.index.designs) {
      if (excluded.has(design.id)) continue;
      if (absorbedInto.has(design.id)) {
        // Replaced by a supplied variant, which must be in the library and say it absorbs this design.
        if (!byId.get(absorbedInto.get(design.id))?.supplied) problems.push(`${design.id}: absorbed into ${absorbedInto.get(design.id)}, which is missing`);
        continue;
      }
      if (mergedInto.has(design.id)) {
        // Not stored: it must draw exactly what the patch it was merged into draws.
        const into = byId.get(mergedInto.get(design.id));
        const original = source.get(design.svgUrl);
        if (!into || !original) problems.push(`${design.id}: merged into ${mergedInto.get(design.id)}, which is missing`);
        else {
          // Against the atlas's own drawing of that patch, which a supplied replacement may have taken over.
          const intoDesign = source.index.designs.find((d) => d.id === into.id);
          const intoAtlas = into.replaced ? Buffer.from(source.get(intoDesign.svgUrl)).toString('utf8') : into.bytes.toString('utf8');
          if (drawingKey(Buffer.from(original).toString('utf8')) !== drawingKey(intoAtlas)) problems.push(`${design.id}: doesn't draw the same as ${into.id}, which it was merged into`);
        }
        continue;
      }
      const p = byId.get(design.id);
      if (!p) { problems.push(`${design.id}: in the snapshot, not in the library (nor excluded)`); continue; }
      const original = source.get(design.svgUrl);
      if (!original) { problems.push(`${design.id}: ${design.svgUrl} missing from the snapshot`); continue; }
      if (p.replaced) {
        // A supplied drawing replaces the atlas's: it must be that file, and the atlas file the one on record.
        if (!readFileSync(join(library, p.replaced.svg)).equals(p.bytes)) problems.push(`${design.id}: joined bytes differ from the supplied ${p.replaced.svg}`);
        if (createHash('sha256').update(original).digest('hex') !== p.replaced.atlasSha256) problems.push(`${design.id}: the atlas's drawing changed since it was replaced`);
        continue;
      }
      if (!Buffer.from(original).equals(p.bytes)) problems.push(`${design.id}: joined bytes differ from the snapshot's ${design.svgUrl}`);
      if (design.vectorSha256 && design.vectorSha256 !== p.sha256) problems.push(`${design.id}: SHA-256 differs from the atlas's vectorSha256`);
    }
    const fromAtlas = patches.filter((p) => !p.supplied).length;
    const accounted = fromAtlas + excluded.size + mergedInto.size + absorbedInto.size;
    if (accounted !== source.index.designs.length) problems.push(`library has ${fromAtlas} atlas patches, ${excluded.size} excluded, ${mergedInto.size} merged and ${absorbedInto.size} absorbed; snapshot has ${source.index.designs.length}`);
  }
  return problems;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2), 'Usage: verify-library.mjs [--source | --zip <file> | --drive <id or URL>]');
  const source = opts.source ? readSnapshot(await snapshotPath(opts)) : undefined;
  const { patches, manifest } = joinedPatches();
  const problems = verifyLibrary({ source });
  const stored = manifest.summary.storedBytes;
  const original = patches.reduce((n, p) => n + p.bytes.length, 0);
  if (problems.length) {
    console.error(`${problems.length} problem(s):`);
    for (const p of problems.slice(0, 50)) console.error(`  ${p}`);
    process.exit(1);
  }
  console.log(
    `All ${patches.length} patches join back byte for byte (${(original / 1e6).toFixed(2)} MB of SVG from ` +
    `${(stored / 1e6).toFixed(2)} MB stored), matching ${source ? 'the atlas snapshot file by file and its' : 'the manifest\'s'} SHA-256.`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
  });
}
