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

/** Patches, and badges (hidden for now). A design is in one collection; an organization can have both. */
export interface LibraryCollection { id: string; name: string; description: string | null; hidden: boolean }

export interface LibraryPatch {
  id: string;
  label: string;
  collection: string;
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
  /** Every photograph the design was seen in (atlas occurrence ids, S27-O01 being photo S27), with its link. */
  sightings: { id: string; sourceUrl: string | null }[];
  /** Atlas entries that draw this same design from another photograph, merged into this one. */
  merged: string[];
  /** Set when a supplied drawing (library/supplied/) replaces the atlas's: its file, and the atlas drawing's SHA-256. */
  replaced?: { svg: string; atlasSha256: string };
  /**
   * Set on a supplied design that isn't an atlas entry (orgs.json "consolidate", ids like FO-forests):
   * its file in library/supplied/, and the atlas entries it takes the place of (none for a new colourway).
   */
  supplied?: { svg: string };
  absorbs?: string[];
  /** The variant group it belongs to (shown as one card with a switch), and its name in it. */
  group?: string;
  variant?: string;
  limitations: string | null;
}

export interface LibraryOrg {
  id: string;
  name: string;
  sector: string;
  description: string | null;
  /** How many of its designs are in each collection. */
  counts: Record<string, number>;
  patches: LibraryPatch[];
}

export interface SharedBlock { id: string; file: string; bytes: number; usedBy: number }
export interface SharedBundle { name: string; file: string; bytes: number; paths: number; usedBy: number }

export interface LibraryManifest {
  version: number;
  source: { name: string; driveId: string | null; snapshotSha256: string | null; note: string };
  summary: {
    designs: number; byCollection: Record<string, number>; excluded: number; merged: number; absorbed: number; orgs: number; unsorted: number;
    sourceBytes: number; storedBytes: number; sharedBlocks: number; sharedPaths: number;
  };
  collections: LibraryCollection[];
  sectors: LibrarySector[];
  shared: { blocks: SharedBlock[]; bundles: SharedBundle[] };
  orgs: LibraryOrg[];
  /** Atlas designs left out on purpose (library/orgs.json), with why. */
  excluded: { id: string; label: string; medium: string; org: string; reason: string }[];
  /** Atlas entries merged into the patch that draws the same design (`into`), with their own labels. */
  merged: { id: string; label: string; into: string }[];
  /** Atlas entries replaced by a supplied design (`into`), with their own labels. */
  absorbed: { id: string; label: string; medium: string; org: string; into: string }[];
  /** Designs shown as one card with a switch between them; the first member is the card. */
  variants: LibraryVariantGroup[];
}

export interface LibraryVariantGroup { id: string; label: string; members: { id: string; name: string }[] }

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

// An atlas id merged into another photograph's patch (S27-O01 into S30-O04), or absorbed into a
// supplied design (R22-O01 into FO-forest-service), still finds the patch that took its place.
const movedTo = new Map([...data.merged, ...(data.absorbed ?? [])].map((m) => [m.id, m.into]));

export const findPatch = (id: string): ResolvedPatch | undefined => byId.get(id) ?? byId.get(movedTo.get(id) ?? '');
export const findOrg = (id: string): ResolvedOrg | undefined => LIBRARY.orgs.find((o) => o.id === id);

export const findCollection = (id: string): LibraryCollection | undefined => LIBRARY.collections.find((c) => c.id === id);

const groups = new Map(data.variants.map((g) => [g.id, g]));

/** A design's variant group with its members resolved, or null when it stands alone. */
export function variantsOf(patch: ResolvedPatch): { group: LibraryVariantGroup; members: (ResolvedPatch & { variant: string })[] } | null {
  const group = patch.group ? groups.get(patch.group) : undefined;
  if (!group) return null;
  return { group, members: group.members.map((m) => ({ ...byId.get(m.id)!, variant: m.name })) };
}

/** What to show as a card: the design, or for a variant group, its first member under the group's label. */
export const isCard = (patch: ResolvedPatch): boolean => !patch.group || groups.get(patch.group)?.members[0].id === patch.id;
export const cardLabel = (patch: ResolvedPatch): string => (patch.group ? groups.get(patch.group)?.label ?? patch.label : patch.label);
/** The card a design is shown under: itself, or its group's first member. */
export const cardOf = (patch: ResolvedPatch): ResolvedPatch => (patch.group ? byId.get(groups.get(patch.group)!.members[0].id) ?? patch : patch);

/** One collection's designs, organization by organization (organizations with none left out). */
export function collectionOrgs(collection = 'patches', lib: Library = LIBRARY): ResolvedOrg[] {
  return lib.orgs
    .map((org) => ({ ...org, patches: org.patches.filter((p) => p.collection === collection) }))
    .filter((org) => org.patches.length > 0);
}

/** Sectors in order, each with its organizations that have designs in the collection. */
export function orgsBySector(collection = 'patches', lib: Library = LIBRARY): { sector: LibrarySector; orgs: ResolvedOrg[] }[] {
  const orgs = collectionOrgs(collection, lib);
  return lib.sectors
    .map((sector) => ({ sector, orgs: orgs.filter((o) => o.sector === sector.id) }))
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
