// The BC Forestry Patch Atlas snapshot: downloading it from Google Drive and reading the parts of it
// the library uses. Shared by import-atlas.mjs and verify-library.mjs.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strFromU8, unzipSync } from 'fflate';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const LIBRARY = join(ROOT, 'library');
const CACHE = join(ROOT, '.cache');
/** The atlas snapshot shared for this library (bc-forestry-patch-atlas-codebase-*.zip). */
export const DEFAULT_DRIVE_ID = '1FttYbiCfmrQW4TbvcDD7lpVG9Y-gRzs4';

/** A Drive file id from an id, a /file/d/<id>/ share link, or a ?id= link. */
export const driveId = (s) => /\/d\/([\w-]{20,})/.exec(s)?.[1] ?? /[?&]id=([\w-]{20,})/.exec(s)?.[1] ?? s;

/** The snapshot's path in .cache/, downloading it first if it isn't there. */
export async function download(id) {
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

/** The snapshot to use: --zip if given, else the Drive file (downloaded once into .cache/). */
export const snapshotPath = (opts) => (opts.zip ? Promise.resolve(resolve(opts.zip)) : download(driveId(opts.drive ?? DEFAULT_DRIVE_ID)));

/** The atlas paths are dist/assets/…; tolerate a ZIP that wraps them in one more folder. */
export function readSnapshot(zipPath) {
  const zip = readFileSync(zipPath);
  const wanted = (name) =>
    /(^|\/)dist\/assets\/reconstructions(\.json|\/[^/]+\.svg|\/previews\/[^/]+\.webp)$/.test(name) ||
    /(^|\/)CODEBASE_SNAPSHOT\.json$/.test(name);
  const files = unzipSync(new Uint8Array(zip.buffer, zip.byteOffset, zip.byteLength), { filter: (f) => wanted(f.name) });
  const indexPath = Object.keys(files).find((n) => n.endsWith('dist/assets/reconstructions.json'));
  if (!indexPath) throw new Error(`${zipPath} has no dist/assets/reconstructions.json — is it the atlas snapshot?`);
  const prefix = indexPath.slice(0, -'assets/reconstructions.json'.length);
  const snapshotFile = Object.keys(files).find((n) => n.endsWith('CODEBASE_SNAPSHOT.json'));
  return {
    index: JSON.parse(strFromU8(files[indexPath])),
    snapshot: snapshotFile ? JSON.parse(strFromU8(files[snapshotFile])) : null,
    /** A file by its atlas URL (assets/…, query string ignored). */
    get: (url) => files[prefix + url.split('?')[0]] ?? null,
  };
}

/** Command-line options shared by the import and the verifier. */
export function parseArgs(argv, usage) {
  const out = { zip: null, drive: DEFAULT_DRIVE_ID, source: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--zip') { out.zip = argv[++i]; out.source = true; }
    else if (a === '--drive') { out.drive = argv[++i]; out.source = true; }
    else if (a === '--source') out.source = true;
    else if (a === '--help' || a === '-h') { console.log(usage); process.exit(0); }
    else throw new Error(`Unknown argument: ${a}\n${usage}`);
  }
  return out;
}
