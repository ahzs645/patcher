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
// snapshot's file directly and its vectorSha256 re-read, and every atlas design must be present.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { joinSvg, unwrapBlock } from '../src/library-join.js';
import { LIBRARY, parseArgs, readSnapshot, snapshotPath } from './atlas-snapshot.mjs';

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
      out.push({ id: patch.id, org: org.id, bytes, sha256: sha(bytes), expected: patch.sha256, expectedBytes: patch.bytes });
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
  }
  if (source) {
    const byId = new Map(patches.map((p) => [p.id, p]));
    const { manifest } = joinedPatches(library);
    const excluded = new Set((manifest.excluded ?? []).map((e) => e.id));
    for (const design of source.index.designs) {
      if (excluded.has(design.id)) continue;
      const p = byId.get(design.id);
      if (!p) { problems.push(`${design.id}: in the snapshot, not in the library (nor excluded)`); continue; }
      const original = source.get(design.svgUrl);
      if (!original) { problems.push(`${design.id}: ${design.svgUrl} missing from the snapshot`); continue; }
      if (!Buffer.from(original).equals(p.bytes)) problems.push(`${design.id}: joined bytes differ from the snapshot's ${design.svgUrl}`);
      if (design.vectorSha256 && design.vectorSha256 !== p.sha256) problems.push(`${design.id}: SHA-256 differs from the atlas's vectorSha256`);
    }
    if (byId.size + excluded.size !== source.index.designs.length) problems.push(`library has ${byId.size} patches and ${excluded.size} excluded, snapshot has ${source.index.designs.length}`);
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
