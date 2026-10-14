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
import { LIBRARY, drawingKey, driveId, parseArgs, readSnapshot, snapshotPath } from './atlas-snapshot.mjs';
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
  const { index, snapshot, get, sources } = source;
  const taxonomy = JSON.parse(readFileSync(join(LIBRARY, 'orgs.json'), 'utf8'));
  const classify = classifier(taxonomy.orgs);
  const sectorIds = new Set(taxonomy.sectors.map((s) => s.id));
  for (const org of taxonomy.orgs) {
    if (!sectorIds.has(org.sector)) throw new Error(`orgs.json: ${org.id} has unknown sector "${org.sector}"`);
    if (org.id === SHARED) throw new Error(`orgs.json: "${SHARED}" is reserved for library/${SHARED}/`);
  }
  const collections = taxonomy.collections ?? [{ id: 'patches', name: 'Patches' }];
  const collectionOf = (design) => collections.find((c) => c.medium?.includes(design.medium)) ?? collections[0];
  const excludedIds = new Map((taxonomy.exclude ?? []).flatMap((rule) => rule.ids.map((id) => [id, rule.reason])));
  const known = new Set(index.designs.map((d) => d.id));
  for (const id of excludedIds.keys()) if (!known.has(id)) throw new Error(`orgs.json excludes ${id}, which isn't in the snapshot`);

  const all = [...index.designs].sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
  const byOrg = new Map();
  const unsorted = [];
  const excluded = [];
  const merged = [];
  const originals = new Map();
  const previews = [];
  const designs = [];

  // Read and check every design that isn't left out, and group the ones that draw the same thing:
  // the atlas has an entry per photograph a design was seen in, fitted to that photograph.
  const kept = [];
  for (const d of all) {
    const org = classify(d) ?? { id: 'unsorted', name: 'Unsorted', sector: 'unconfirmed' };
    const reason = excludedIds.get(d.id) ?? org.exclude;
    if (reason) {
      excluded.push({ id: d.id, label: d.label, medium: d.medium, org: org.id, reason });
      continue;
    }
    const svg = get(d.svgUrl);
    if (!svg) throw new Error(`${d.id}: ${d.svgUrl} is missing from the snapshot`);
    const text = strFromU8(svg);
    if (!Buffer.from(text, 'utf8').equals(Buffer.from(svg))) throw new Error(`${d.id}: not valid UTF-8, so it can't be stored as text`);
    if (d.vectorSha256 && d.vectorSha256 !== sha(svg)) throw new Error(`${d.id}: the snapshot's SVG doesn't match the atlas's own vectorSha256`);
    checkSvg(d.id, text);
    kept.push({ d, org, svg, text, key: `${org.id} ${collectionOf(d).id} ${drawingKey(text)}` });
  }
  const groups = new Map();
  for (const entry of kept) groups.set(entry.key, [...(groups.get(entry.key) ?? []), entry]);

  // The most common label, the more descriptive on a tie ("scenic arch" over "large scenic arch").
  const labelFor = (entries) => {
    const counts = new Map();
    for (const { d } of entries) counts.set(d.label, (counts.get(d.label) ?? 0) + 1);
    return [...counts].sort(([a, n], [b, m]) => m - n || b.length - a.length || (a < b ? -1 : 1))[0][0];
  };
  // Of a group, keep the one drawn from the largest crop of its photograph: the sharpest preview.
  const area = ({ d }) => (d.bbox ? (d.bbox[2] - d.bbox[0]) * (d.bbox[3] - d.bbox[1]) : 0);

  for (const group of groups.values()) {
    const primary = [...group].sort((a, b) => area(b) - area(a) || (a.d.id < b.d.id ? -1 : 1))[0];
    const { d, org, svg, text } = primary;
    const others = group.filter((entry) => entry !== primary);
    for (const { d: other } of others) merged.push({ id: other.id, label: other.label, into: d.id });
    // Every photograph the design was seen in, by the atlas's occurrence ids (S27-O01 is photo S27).
    const occurrences = [...new Set(group.flatMap(({ d: g }) => g.occurrences?.length ? g.occurrences : [g.id]))]
      .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
    const sightings = occurrences.map((id) => ({ id, sourceUrl: sources.get(id.replace(/-O\d+$/, '')) ?? null }));

    designs.push(d);
    if (org.id === 'unsorted') unsorted.push(d);
    originals.set(d.id, text);
    const preview = d.previewUrl ? get(d.previewUrl) : null;
    const previewPath = preview ? `${org.id}/previews/${d.id}.webp` : null;
    if (preview) previews.push([previewPath, preview]);
    if (!byOrg.has(org.id)) byOrg.set(org.id, { org, patches: [] });
    byOrg.get(org.id).patches.push({
      id: d.id,
      label: group.length > 1 ? labelFor(group) : d.label,
      collection: collectionOf(d).id,
      medium: d.medium,
      quality: d.quality,
      family: d.family,
      affiliation: d.affiliation,
      svg: `${org.id}/${d.id}.svg`,
      preview: previewPath,
      sha256: sha(svg),
      bytes: svg.length,
      sourceUrl: d.originalSourceUrl ?? null,
      sightings,
      merged: others.map(({ d: other }) => other.id),
      limitations: d.limitations ?? null,
    });
  }
  for (const { patches } of byOrg.values()) patches.sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));

  // Variant groups: designs shown as one card with a switch between them (orgs.json "variants").
  const patchById = new Map([...byOrg.values()].flatMap(({ patches }) => patches.map((p) => [p.id, p])));
  const mergedInto = new Map(merged.map((m) => [m.id, m.into]));
  const variantGroups = (taxonomy.variants ?? []).map((group) => {
    const members = group.members.map(({ id, name }) => {
      const patch = patchById.get(mergedInto.get(id) ?? id);
      if (!patch) throw new Error(`orgs.json variant group ${group.id}: ${id} isn't in the library`);
      if (patch.group) throw new Error(`orgs.json: ${patch.id} is in two variant groups (${patch.group}, ${group.id})`);
      patch.group = group.id;
      patch.variant = name;
      return { id: patch.id, name };
    });
    const collectionsIn = new Set(members.map((m) => patchById.get(m.id).collection));
    if (collectionsIn.size > 1) throw new Error(`orgs.json variant group ${group.id} spans collections`);
    return { id: group.id, label: group.label ?? patchById.get(members[0].id).label, members };
  });

  // Store what repeats once.
  const groupOf = new Map([...patchById].filter(([, p]) => p.group).map(([id, p]) => [id, p.group]));
  const shared = shareParts(originals, { groupOf });

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
      const counts = Object.fromEntries(collections.map((c) => [c.id, patches.filter((p) => p.collection === c.id).length]));
      return { id: o.id, name: o.name, sector: o.sector, description: o.description ?? null, counts, patches };
    });
  const sourceBytes = [...originals.values()].reduce((n, text) => n + Buffer.byteLength(text), 0);
  const manifest = {
    version: 3,
    source: {
      name: 'BC Forestry Patch Atlas',
      driveId: opts.zip ? null : driveId(opts.drive),
      snapshotSha256: snapshot?.snapshotSha256 ?? null,
      note: 'Reference-based vector reconstructions, not authenticated issue artwork. See each patch\'s limitations.',
    },
    summary: {
      designs: designs.length,
      byCollection: Object.fromEntries(collections.map((c) => [c.id, designs.filter((d) => collectionOf(d).id === c.id).length])),
      excluded: excluded.length,
      merged: merged.length,
      orgs: orderedOrgs.length,
      unsorted: unsorted.length,
      sourceBytes,
      storedBytes,
      sharedBlocks: blocks.length,
      sharedPaths: shared.paths.size,
    },
    collections: collections.map(({ id, name, description, hidden }) => ({ id, name, description: description ?? null, hidden: Boolean(hidden) })),
    sectors: taxonomy.sectors.filter((s) => orderedOrgs.some((o) => o.sector === s.id)),
    shared: { blocks, bundles },
    orgs: orderedOrgs,
    /** Atlas designs left out on purpose (orgs.json), so the record of what was dropped stays with the library. */
    excluded,
    /** Atlas entries that draw the same design as a kept one (another photograph of it), and which. */
    merged,
    /** Designs shown as one card with a switch between them; the first member is the card. */
    variants: variantGroups,
  };
  writeFileSync(join(LIBRARY, 'manifest.json'), `${JSON.stringify(manifest, null, 1)}\n`);

  // Join every patch back from what was just written and compare with the snapshot.
  const problems = verifyLibrary({ source });
  if (problems.length) {
    console.error(`The library doesn't join back to the snapshot (${problems.length} problem(s)):`);
    for (const p of problems.slice(0, 50)) console.error(`  ${p}`);
    process.exit(1);
  }

  console.log(`Imported ${designs.length} designs into ${orderedOrgs.length} organizations (${excluded.length} left out by orgs.json, ${merged.length} merged into the same drawing):`);
  for (const o of orderedOrgs) {
    const counts = Object.entries(o.counts).filter(([, n]) => n).map(([c, n]) => `${n} ${c}`).join(', ');
    console.log(`  ${o.name}: ${counts}`);
  }
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
