// The patch library: SVG patch art grouped by organization, imported by
// scripts/import-atlas.mjs into library/ (see library/README.md).
//
//   import { LIBRARY, findPatch } from 'patcher/library';
//   for (const org of LIBRARY.orgs) for (const p of org.patches) show(p.previewUrl, p.label);
//   const svgText = await (await fetch(findPatch('S25-O01')!.svgUrl)).text();
//
// Uses Vite's import.meta.glob, so every SVG and preview is emitted as an asset
// of the app that imports this and its URLs resolve under that app's base.
// Other bundlers can read library/manifest.json and the files beside it directly.

import manifest from '../library/manifest.json';

export interface LibrarySector { id: string; name: string }

export interface LibraryPatch {
  id: string;
  label: string;
  medium: string;
  quality: string;
  family: string;
  /** The atlas's own coarse affiliation, kept for reference. */
  affiliation: string;
  /** Path inside library/. */
  svg: string;
  preview: string | null;
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

export interface LibraryManifest {
  version: number;
  source: { name: string; driveId: string | null; snapshotSha256: string | null; note: string };
  summary: { patches: number; orgs: number; unsorted: number };
  sectors: LibrarySector[];
  orgs: LibraryOrg[];
}

/** A patch with its organization and URLs the importing app can load. */
export interface ResolvedPatch extends LibraryPatch {
  orgId: string;
  svgUrl: string;
  previewUrl: string | null;
}

export interface ResolvedOrg extends Omit<LibraryOrg, 'patches'> {
  patches: ResolvedPatch[];
}

export interface Library extends Omit<LibraryManifest, 'orgs'> {
  orgs: ResolvedOrg[];
}

const svgUrls = import.meta.glob('../library/*/*.svg', { query: '?no-inline&url', import: 'default', eager: true }) as Record<string, string>;
const previewUrls = import.meta.glob('../library/*/previews/*.webp', { query: '?no-inline&url', import: 'default', eager: true }) as Record<string, string>;

const data = manifest as unknown as LibraryManifest;

export const LIBRARY: Library = {
  ...data,
  orgs: data.orgs.map((org) => ({
    ...org,
    patches: org.patches.map((p) => ({
      ...p,
      orgId: org.id,
      svgUrl: svgUrls[`../library/${p.svg}`],
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
