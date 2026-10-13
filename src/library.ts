// The patch library: SVG patch art grouped by organization, imported by
// scripts/import-atlas.mjs into library/ (see library/README.md).
//
//   import { LIBRARY, findPatch, loadPatchSvg } from 'patcher/library';
//   for (const org of LIBRARY.orgs) for (const p of org.patches) show(p.previewUrl, p.label);
//   const svgText = await loadPatchSvg(findPatch('S25-O01')!);
//
// Patches are stored with what they repeat (crests, coats of arms, lettering outlines) kept once in
// library/shared/, so a patch's file is not its whole drawing: loadPatchSvg fetches the file and the
// shared parts it names, all at once, joins them (src/library-join.js) and checks the result
// against the atlas's SHA-256. Shared parts are fetched once and reused by every patch after.
//
// Uses Vite's import.meta.glob, so every file is emitted as an asset of the app that imports this
// and its URLs resolve under that app's base. Other bundlers can read library/manifest.json and
// join with src/library-join.js themselves.

import manifest from '../library/manifest.json';
import { joinSvg, unwrapBlock } from './library-join.js';

export interface LibrarySector { id: string; name: string }

export interface LibraryPatch {
  id: string;
  label: string;
  medium: string;
  quality: string;
  family: string;
  /** The atlas's own coarse affiliation, kept for reference. */
  affiliation: string;
  /** The stored file, inside library/: references into shared/, not the whole drawing. */
  svg: string;
  preview: string | null;
  /** SHA-256 and size of the whole drawing, as the atlas published it. */
  sha256: string;
  bytes: number;
  /** Shared blocks and path bundles the stored file needs, directly or through other blocks. */
  blocks: string[];
  bundles: string[];
  /** Where the source photograph or document lives (Google Drive). */
  sourceUrl: string | null;
  limitations: string | null;
}

export interface LibraryOrg {
  id: string;
  name: string;
  sector: string;
  description: string | null;
  count: number;
  patches: LibraryPatch[];
}

export interface SharedBlock { id: string; file: string; bytes: number; usedBy: number }
export interface SharedBundle { name: string; file: string; bytes: number; paths: number; usedBy: number }

export interface LibraryManifest {
  version: number;
  source: { name: string; driveId: string | null; snapshotSha256: string | null; note: string };
  summary: {
    patches: number; orgs: number; unsorted: number;
    sourceBytes: number; storedBytes: number; sharedBlocks: number; sharedPaths: number;
  };
  sectors: LibrarySector[];
  shared: { blocks: SharedBlock[]; bundles: SharedBundle[] };
  orgs: LibraryOrg[];
}

/** A patch with its organization and the URLs the importing app serves. */
export interface ResolvedPatch extends LibraryPatch {
  orgId: string;
  /** The stored file. Use loadPatchSvg for the drawing. */
  fileUrl: string;
  previewUrl: string | null;
}

export interface ResolvedOrg extends Omit<LibraryOrg, 'patches'> {
  patches: ResolvedPatch[];
}

export interface Library extends Omit<LibraryManifest, 'orgs'> {
  orgs: ResolvedOrg[];
}

const svgUrls = import.meta.glob('../library/*/*.svg', { query: '?no-inline&url', import: 'default', eager: true }) as Record<string, string>;
const bundleUrls = import.meta.glob('../library/shared/*.json', { query: '?no-inline&url', import: 'default', eager: true }) as Record<string, string>;
const previewUrls = import.meta.glob('../library/*/previews/*.webp', { query: '?no-inline&url', import: 'default', eager: true }) as Record<string, string>;

const data = manifest as unknown as LibraryManifest;

export const LIBRARY: Library = {
  ...data,
  orgs: data.orgs.map((org) => ({
    ...org,
    patches: org.patches.map((p) => ({
      ...p,
      orgId: org.id,
      fileUrl: svgUrls[`../library/${p.svg}`],
      previewUrl: p.preview ? previewUrls[`../library/${p.preview}`] ?? null : null,
    })),
  })),
};

const byId = new Map(LIBRARY.orgs.flatMap((o) => o.patches.map((p) => [p.id, p] as const)));

export const findPatch = (id: string): ResolvedPatch | undefined => byId.get(id);
export const findOrg = (id: string): ResolvedOrg | undefined => LIBRARY.orgs.find((o) => o.id === id);

/** Sectors in order, each with its organizations. */
export function orgsBySector(lib: Library = LIBRARY): { sector: LibrarySector; orgs: ResolvedOrg[] }[] {
  return lib.sectors
    .map((sector) => ({ sector, orgs: lib.orgs.filter((o) => o.sector === sector.id) }))
    .filter((s) => s.orgs.length > 0);
}

// ---------------------------------------------------------------- loading a drawing

const blockFile = new Map(data.shared.blocks.map((b) => [b.id, b.file]));
const bundleFile = new Map(data.shared.bundles.map((b) => [b.name, b.file]));

async function fetchText(url: string | undefined, what: string): Promise<string> {
  if (!url) throw new Error(`${what} is not in this build of the library`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${what}: HTTP ${res.status}`);
  return res.text();
}

// Shared parts, fetched once per page and kept: most of them serve several patches. A failed fetch
// is forgotten so the next attempt retries it.
const blocks = new Map<string, Promise<string>>();
const bundles = new Map<string, Promise<Record<string, string>>>();

function cached<T>(cache: Map<string, Promise<T>>, key: string, load: () => Promise<T>): Promise<T> {
  if (!cache.has(key)) cache.set(key, load().catch((err) => { cache.delete(key); throw err; }));
  return cache.get(key)!;
}

const loadBlock = (id: string) => cached(blocks, id, () => {
  const file = blockFile.get(id);
  return fetchText(file && svgUrls[`../library/${file}`], `Shared block ${id}`).then((f) => unwrapBlock(id, f));
});
const loadBundle = (name: string) => cached(bundles, name, () => {
  const file = bundleFile.get(name);
  return fetchText(file && bundleUrls[`../library/${file}`], `Path bundle ${name}`).then((f) => JSON.parse(f) as Record<string, string>);
});

async function sha256(value: string): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * A library patch's whole drawing, exactly as the atlas published it. Rejects if a part is missing
 * or the joined drawing's SHA-256 isn't the atlas's (checked where the page can hash: https or localhost).
 */
export async function loadPatchSvg(patch: ResolvedPatch): Promise<string> {
  const [stored, blockTexts, bundleMaps] = await Promise.all([
    fetchText(patch.fileUrl, patch.id),
    Promise.all(patch.blocks.map((id) => loadBlock(id).then((content) => [id, content] as const))),
    Promise.all(patch.bundles.map(loadBundle)),
  ]);
  const blockMap = new Map(blockTexts);
  const paths: Record<string, string> = Object.assign({}, ...bundleMaps);
  const svg = joinSvg(stored, { block: (id) => blockMap.get(id), path: (id) => paths[id] });
  const hash = await sha256(svg);
  if (hash && hash !== patch.sha256) throw new Error(`${patch.id} didn't join back to the atlas's drawing`);
  return svg;
}
