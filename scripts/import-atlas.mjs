#!/usr/bin/env node
// Import the BC Forestry Patch Atlas snapshot into library/, grouped by organization.
//
//   npm run library:import                      # download the snapshot from Google Drive
//   npm run library:import -- --zip atlas.zip   # or use a copy you already have
//   npm run library:import -- --drive <id|url>  # or another Drive file
//
// The snapshot is the atlas site's own "Entire codebase" ZIP. Only its reconstructions are read:
// dist/assets/reconstructions.json, each design's SVG and its WebP preview. Each design is filed
// under the first organization in library/orgs.json whose rules match it, then written to
// library/<org>/<id>.svg (+ previews/<id>.webp), with library/manifest.json listing the lot.
// The output is deterministic, so re-importing the same snapshot changes nothing.

import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync, strFromU8 } from 'fflate';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LIBRARY = join(ROOT, 'library');
const CACHE = join(ROOT, '.cache');
/** The atlas snapshot shared for this library (bc-forestry-patch-atlas-codebase-*.zip). */
const DEFAULT_DRIVE_ID = '1FttYbiCfmrQW4TbvcDD7lpVG9Y-gRzs4';
/** Files library/ keeps across imports; everything else in it is regenerated. */
const KEEP = new Set(['orgs.json', 'README.md']);

function args(argv) {
  const out = { zip: null, drive: DEFAULT_DRIVE_ID, keepZip: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--zip') out.zip = argv[++i];
    else if (a === '--drive') out.drive = argv[++i];
    else if (a === '--help' || a === '-h') {
      console.log('Usage: import-atlas.mjs [--zip <file>] [--drive <file id or share URL>]');
      process.exit(0);
    } else throw new Error(`Unknown argument: ${a}`);
  }
  return out;
}

const driveId = (s) => /\/d\/([\w-]{20,})/.exec(s)?.[1] ?? /[?&]id=([\w-]{20,})/.exec(s)?.[1] ?? s;

async function download(id) {
  const target = join(CACHE, `atlas-${id}.zip`);
  if (existsSync(target)) {
    console.log(`Using the downloaded snapshot in ${target} (delete it to download again).`);
    return target;
  }
  // confirm=t skips Drive's "too large to scan for viruses" page, which large files always get.
  const url = `https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download&confirm=t`;
  console.log(`Downloading the atlas snapshot from Google Drive (${id})…`);
  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    throw new Error(
      `Couldn't reach Google Drive (${err.cause?.code ?? err.message}). Behind a proxy, run with NODE_USE_ENV_PROXY=1, ` +
      `or download the ZIP yourself and pass --zip <file>.`,
    );
  }
  const type = res.headers.get('content-type') ?? '';
  if (!res.ok || type.startsWith('text/html')) {
    throw new Error(`Google Drive didn't return the file (HTTP ${res.status}, ${type}). Is it shared as "Anyone with the link"?`);
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(target, buf);
  console.log(`Saved ${(buf.length / 1e6).toFixed(1)} MB to ${target}.`);
  return target;
}

/** The atlas paths are dist/assets/…; tolerate a ZIP that wraps them in one more folder. */
function readSnapshot(zipPath) {
  const zip = readFileSync(zipPath);
  const wanted = (name) =>
    /(^|\/)dist\/assets\/reconstructions(\.json|\/[^/]+\.svg|\/previews\/[^/]+\.webp)$/.test(name) ||
    /(^|\/)CODEBASE_SNAPSHOT\.json$/.test(name);
  const files = unzipSync(new Uint8Array(zip.buffer, zip.byteOffset, zip.byteLength), { filter: (f) => wanted(f.name) });
  const indexPath = Object.keys(files).find((n) => n.endsWith('dist/assets/reconstructions.json'));
  if (!indexPath) throw new Error(`${zipPath} has no dist/assets/reconstructions.json — is it the atlas snapshot?`);
  const prefix = indexPath.slice(0, -'assets/reconstructions.json'.length);
  const snapshotPath = Object.keys(files).find((n) => n.endsWith('CODEBASE_SNAPSHOT.json'));
  return {
    index: JSON.parse(strFromU8(files[indexPath])),
    snapshot: snapshotPath ? JSON.parse(strFromU8(files[snapshotPath])) : null,
    /** A file by its atlas URL (assets/…, query string ignored). */
    get: (url) => files[prefix + url.split('?')[0]] ?? null,
  };
}

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
}

function clearGenerated() {
  if (!existsSync(LIBRARY)) return;
  for (const name of readdirSync(LIBRARY)) {
    if (KEEP.has(name)) continue;
    const p = join(LIBRARY, name);
    rmSync(p, { recursive: statSync(p).isDirectory(), force: true });
  }
}

async function main() {
  const opts = args(process.argv.slice(2));
  const zipPath = opts.zip ? resolve(opts.zip) : await download(driveId(opts.drive));
  const { index, snapshot, get } = readSnapshot(zipPath);
  const taxonomy = JSON.parse(readFileSync(join(LIBRARY, 'orgs.json'), 'utf8'));
  const classify = classifier(taxonomy.orgs);
  const sectorIds = new Set(taxonomy.sectors.map((s) => s.id));
  for (const org of taxonomy.orgs) {
    if (!sectorIds.has(org.sector)) throw new Error(`orgs.json: ${org.id} has unknown sector "${org.sector}"`);
  }

  const designs = [...index.designs].sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
  const byOrg = new Map();
  const unsorted = [];
  const writes = [];
  for (const d of designs) {
    const org = classify(d) ?? { id: 'unsorted', name: 'Unsorted', sector: 'unconfirmed' };
    if (org.id === 'unsorted') unsorted.push(d);
    const svg = get(d.svgUrl);
    if (!svg) throw new Error(`${d.id}: ${d.svgUrl} is missing from the snapshot`);
    checkSvg(d.id, strFromU8(svg));
    const preview = d.previewUrl ? get(d.previewUrl) : null;
    const svgPath = `${org.id}/${d.id}.svg`;
    const previewPath = preview ? `${org.id}/previews/${d.id}.webp` : null;
    writes.push([svgPath, svg]);
    if (preview) writes.push([previewPath, preview]);
    if (!byOrg.has(org.id)) byOrg.set(org.id, { org, patches: [] });
    byOrg.get(org.id).patches.push({
      id: d.id,
      label: d.label,
      medium: d.medium,
      quality: d.quality,
      family: d.family,
      affiliation: d.affiliation,
      svg: svgPath,
      preview: previewPath,
      sourceUrl: d.originalSourceUrl ?? null,
      limitations: d.limitations ?? null,
    });
  }

  clearGenerated();
  for (const [rel, bytes] of writes) {
    const p = join(LIBRARY, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, bytes);
  }

  // Listed by sector, in orgs.json's sector order; within a sector, in orgs.json's order.
  const sectorOrder = taxonomy.sectors.map((sector) => sector.id);
  const orderedOrgs = [...taxonomy.orgs, { id: 'unsorted', name: 'Unsorted', sector: 'unconfirmed' }]
    .filter((o) => byOrg.has(o.id))
    .sort((a, b) => sectorOrder.indexOf(a.sector) - sectorOrder.indexOf(b.sector))
    .map((o) => {
      const { patches } = byOrg.get(o.id);
      return { id: o.id, name: o.name, sector: o.sector, description: o.description ?? null, count: patches.length, patches };
    });
  const manifest = {
    version: 1,
    source: {
      name: 'BC Forestry Patch Atlas',
      driveId: opts.zip ? null : driveId(opts.drive),
      snapshotSha256: snapshot?.snapshotSha256 ?? null,
      note: 'Reference-based vector reconstructions, not authenticated issue artwork. See each patch\'s limitations.',
    },
    summary: { patches: designs.length, orgs: orderedOrgs.length, unsorted: unsorted.length },
    sectors: taxonomy.sectors.filter((s) => orderedOrgs.some((o) => o.sector === s.id)),
    orgs: orderedOrgs,
  };
  writeFileSync(join(LIBRARY, 'manifest.json'), `${JSON.stringify(manifest, null, 1)}\n`);

  console.log(`Imported ${designs.length} patches into ${orderedOrgs.length} organizations:`);
  for (const o of orderedOrgs) console.log(`  ${String(o.count).padStart(3)}  ${o.name}`);
  if (unsorted.length) {
    console.warn(`\n${unsorted.length} design(s) matched no organization; add a rule to library/orgs.json:`);
    for (const d of unsorted) console.warn(`  ${d.id}  family=${d.family}  affiliation=${d.affiliation}  ${d.label}`);
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
