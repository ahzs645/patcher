#!/usr/bin/env node
// Import the BC Forestry Patch Atlas snapshot into library/, grouped by organization.
//
//   npm run library:import                      # download the snapshot from Google Drive
//   npm run library:import -- --zip atlas.zip   # or use a copy you already have
//   npm run library:import -- --drive <id|url>  # or another Drive file
//
// The snapshot is the atlas site's own "Entire codebase" ZIP. Only its reconstructions are read:
// dist/assets/reconstructions.json, each design's SVG and its WebP preview. Each design is filed
// under the first organization in library/orgs.json whose rules match it.
//
// What the drawings repeat (crests, coats of arms, lettering outlines) is stored once in
// library/shared/ (scripts/share-parts.mjs), so each patch is stored as library/<org>/<id>.svg
// with references into it, plus previews/<id>.webp. library/manifest.json lists the lot, with each
// patch's original SHA-256 and the shared files it needs. Before finishing, every patch is joined
// back from disk and compared with the snapshot byte for byte (scripts/verify-library.mjs).
// The output is deterministic, so re-importing the same snapshot changes nothing.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { strFromU8 } from 'fflate';
import { hasReferences, wrapBlock } from '../src/library-join.js';
import { LIBRARY, driveId, parseArgs, readSnapshot, snapshotPath } from './atlas-snapshot.mjs';
import { shareParts } from './share-parts.mjs';
import { verifyLibrary } from './verify-library.mjs';

/** Files library/ keeps across imports; everything else in it is regenerated. */
const KEEP = new Set(['orgs.json', 'README.md']);
/** library/shared/ holds the shared blocks and path bundles, so no organization may be called that. */
const SHARED = 'shared';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

function classifier(orgs) {
  const compiled = orgs.map((org) => ({
    org,
    family: (org.match?.family ?? []).map((r) => new RegExp(r, 'i')),
    label: (org.match?.label ?? []).map((r) => new RegExp(r, 'i')),
    affiliation: new Set(org.match?.affiliation ?? []),
  }));
  return (design) =>
    compiled.find(
      (c) =>
        c.family.some((r) => r.test(design.family ?? '')) ||
        c.label.some((r) => r.test(design.label ?? '')) ||
        c.affiliation.has(design.affiliation),
    )?.org ?? null;
}

/**
 * The atlas SVGs are plain drawings; refuse anything that could act or reach out when shown,
 * rather than trust a downloaded file. (Patcher only ever displays SVG through <img> anyway.)
 */
function checkSvg(id, text) {
  if (!/^\s*(<\?xml[^>]*>\s*)?<svg[\s>]/.test(text)) throw new Error(`${id}: not an SVG`);
  const bad =
    /<script|<foreignObject|\son[a-z]+\s*=|javascript:/i.exec(text) ??
    /(?:xlink:)?href\s*=\s*["'](?!#|data:image\/)/i.exec(text) ??
    /url\(\s*["']?(?!#)/i.exec(text);
  if (bad) throw new Error(`${id}: refused, the SVG contains "${bad[0]}"`);
  if (hasReferences(text)) throw new Error(`${id}: already contains a shared-part reference, so it couldn't be joined back unambiguously`);
}

function clearGenerated() {
  if (!existsSync(LIBRARY)) return;
  for (const name of readdirSync(LIBRARY)) {
    if (KEEP.has(name)) continue;
    const p = join(LIBRARY, name);
    rmSync(p, { recursive: statSync(p).isDirectory(), force: true });
  }
}

function write(rel, data) {
  const p = join(LIBRARY, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, data);
  return Buffer.byteLength(data);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2), 'Usage: import-atlas.mjs [--zip <file>] [--drive <file id or share URL>]');
  const source = readSnapshot(await snapshotPath(opts));
  const { index, snapshot, get } = source;
  const taxonomy = JSON.parse(readFileSync(join(LIBRARY, 'orgs.json'), 'utf8'));
  const classify = classifier(taxonomy.orgs);
  const sectorIds = new Set(taxonomy.sectors.map((s) => s.id));
  for (const org of taxonomy.orgs) {
    if (!sectorIds.has(org.sector)) throw new Error(`orgs.json: ${org.id} has unknown sector "${org.sector}"`);
    if (org.id === SHARED) throw new Error(`orgs.json: "${SHARED}" is reserved for library/${SHARED}/`);
  }

  const designs = [...index.designs].sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
  const byOrg = new Map();
  const unsorted = [];
  const originals = new Map();
  const previews = [];
  for (const d of designs) {
    const org = classify(d) ?? { id: 'unsorted', name: 'Unsorted', sector: 'unconfirmed' };
    if (org.id === 'unsorted') unsorted.push(d);
    const svg = get(d.svgUrl);
    if (!svg) throw new Error(`${d.id}: ${d.svgUrl} is missing from the snapshot`);
    const text = strFromU8(svg);
    if (!Buffer.from(text, 'utf8').equals(Buffer.from(svg))) throw new Error(`${d.id}: not valid UTF-8, so it can't be stored as text`);
    if (d.vectorSha256 && d.vectorSha256 !== sha(svg)) throw new Error(`${d.id}: the snapshot's SVG doesn't match the atlas's own vectorSha256`);
    checkSvg(d.id, text);
    originals.set(d.id, text);
    const preview = d.previewUrl ? get(d.previewUrl) : null;
    const previewPath = preview ? `${org.id}/previews/${d.id}.webp` : null;
    if (preview) previews.push([previewPath, preview]);
    if (!byOrg.has(org.id)) byOrg.set(org.id, { org, patches: [] });
    byOrg.get(org.id).patches.push({
      id: d.id,
      label: d.label,
      medium: d.medium,
      quality: d.quality,
      family: d.family,
      affiliation: d.affiliation,
      svg: `${org.id}/${d.id}.svg`,
      preview: previewPath,
      sha256: sha(svg),
      bytes: svg.length,
      sourceUrl: d.originalSourceUrl ?? null,
      limitations: d.limitations ?? null,
    });
  }

  // Store what repeats once.
  const shared = shareParts(originals);

  clearGenerated();
  let storedBytes = 0;
  for (const { patches } of byOrg.values()) {
    for (const patch of patches) {
      storedBytes += write(patch.svg, shared.docs.get(patch.id));
      const needs = shared.needs.get(patch.id);
      patch.blocks = needs.blocks;
      patch.bundles = needs.bundles;
    }
  }
  const blocks = [...shared.blocks].sort(([a], [b]) => (a < b ? -1 : 1)).map(([id, content]) => {
    const file = `${SHARED}/${id}.svg`;
    const bytes = write(file, wrapBlock(id, content));
    storedBytes += bytes;
    return { id, file, bytes, usedBy: [...shared.needs.values()].filter((n) => n.blocks.includes(id)).length };
  });
  const bundles = shared.bundles.map(({ name, ids }) => {
    const file = `${SHARED}/${name}.json`;
    const values = Object.fromEntries(ids.map((id) => [id, shared.paths.get(id)]));
    const bytes = write(file, `${JSON.stringify(values, null, 0).replace(/","/g, '",\n"')}\n`);
    storedBytes += bytes;
    return { name, file, bytes, paths: ids.length, usedBy: [...shared.needs.values()].filter((n) => n.bundles.includes(name)).length };
  });
  for (const [rel, bytes] of previews) write(rel, bytes);

  // Listed by sector, in orgs.json's sector order; within a sector, in orgs.json's order.
  const sectorOrder = taxonomy.sectors.map((sector) => sector.id);
  const orderedOrgs = [...taxonomy.orgs, { id: 'unsorted', name: 'Unsorted', sector: 'unconfirmed' }]
    .filter((o) => byOrg.has(o.id))
    .sort((a, b) => sectorOrder.indexOf(a.sector) - sectorOrder.indexOf(b.sector))
    .map((o) => {
      const { patches } = byOrg.get(o.id);
      return { id: o.id, name: o.name, sector: o.sector, description: o.description ?? null, count: patches.length, patches };
    });
  const sourceBytes = [...originals.values()].reduce((n, text) => n + Buffer.byteLength(text), 0);
  const manifest = {
    version: 2,
    source: {
      name: 'BC Forestry Patch Atlas',
      driveId: opts.zip ? null : driveId(opts.drive),
      snapshotSha256: snapshot?.snapshotSha256 ?? null,
      note: 'Reference-based vector reconstructions, not authenticated issue artwork. See each patch\'s limitations.',
    },
    summary: {
      patches: designs.length,
      orgs: orderedOrgs.length,
      unsorted: unsorted.length,
      sourceBytes,
      storedBytes,
      sharedBlocks: blocks.length,
      sharedPaths: shared.paths.size,
    },
    sectors: taxonomy.sectors.filter((s) => orderedOrgs.some((o) => o.sector === s.id)),
    shared: { blocks, bundles },
    orgs: orderedOrgs,
  };
  writeFileSync(join(LIBRARY, 'manifest.json'), `${JSON.stringify(manifest, null, 1)}\n`);

  // Join every patch back from what was just written and compare with the snapshot.
  const problems = verifyLibrary({ source });
  if (problems.length) {
    console.error(`The library doesn't join back to the snapshot (${problems.length} problem(s)):`);
    for (const p of problems.slice(0, 50)) console.error(`  ${p}`);
    process.exit(1);
  }

  console.log(`Imported ${designs.length} patches into ${orderedOrgs.length} organizations:`);
  for (const o of orderedOrgs) console.log(`  ${String(o.count).padStart(3)}  ${o.name}`);
  console.log(
    `\nStored ${(storedBytes / 1e6).toFixed(2)} MB of SVG for ${(sourceBytes / 1e6).toFixed(2)} MB of drawings: ` +
    `${blocks.length} shared blocks, ${shared.paths.size} shared path outlines in ${bundles.length} bundles.`,
  );
  console.log('Every patch joins back to the snapshot\'s file byte for byte.');
  if (unsorted.length) {
    console.warn(`\n${unsorted.length} design(s) matched no organization; add a rule to library/orgs.json:`);
    for (const d of unsorted) console.warn(`  ${d.id}  family=${d.family}  affiliation=${d.affiliation}  ${d.label}`);
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
