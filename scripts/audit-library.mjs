#!/usr/bin/env node
// Read-only catalogue/storage audit. No network, atlas download or third-party dependencies.
//   node scripts/audit-library.mjs
//   node scripts/audit-library.mjs --library /path/to/library
// The manifest hash identifies the input; output has no clock-dependent fields.

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveTemplateFamilies } from '../src/template-families.js';

const DEFAULT_LIBRARY = resolve(dirname(fileURLToPath(import.meta.url)), '../library');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const totalBytes = (files) => files.reduce((n, file) => n + file.bytes, 0);

function inventory(root) {
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) files.push({ path: relative(root, absolute).split('\\').join('/'), bytes: statSync(absolute).size });
    }
  };
  visit(root);
  return files;
}

function duplicateContent(root, files) {
  const byHash = new Map();
  for (const file of files) {
    const sha256 = hash(readFileSync(join(root, file.path)));
    if (!byHash.has(sha256)) byHash.set(sha256, { sha256, bytes: file.bytes, paths: [] });
    byHash.get(sha256).paths.push(file.path);
  }
  const duplicates = [...byHash.values()].filter((group) => group.paths.length > 1)
    .sort((a, b) => b.bytes - a.bytes || (a.sha256 < b.sha256 ? -1 : 1));
  return {
    files: files.length,
    bytes: totalBytes(files),
    uniqueContentCount: byHash.size,
    uniqueContentBytes: [...byHash.values()].reduce((n, group) => n + group.bytes, 0),
    duplicateBytes: duplicates.reduce((n, group) => n + group.bytes * (group.paths.length - 1), 0),
    duplicates,
  };
}

/** Inspect existing generated files; this does not verify or change their drawings. */
export function auditLibrary(library = DEFAULT_LIBRARY) {
  const manifestBytes = readFileSync(join(library, 'manifest.json'));
  const manifest = JSON.parse(manifestBytes);
  const files = inventory(library);
  const byPath = new Map(files.map((file) => [file.path, file]));
  const patches = manifest.orgs.flatMap((org) => org.patches);
  const variants = manifest.variants ?? [];
  const templateBytes = readFileSync(join(library, 'template-families.json'));
  const templates = resolveTemplateFamilies(manifest, JSON.parse(templateBytes));
  const classified = new Set(templates.flatMap((family) => family.members));
  const groups = new Map(variants.map((group) => [group.id, group]));
  const isCard = (patch) => !patch.group || groups.get(patch.group)?.members[0]?.id === patch.id;
  const references = new Set([
    ...patches.map((patch) => patch.svg),
    ...manifest.shared.blocks.map((block) => block.file),
    ...manifest.shared.bundles.map((bundle) => bundle.file),
  ]);
  const missingFiles = [...references, ...patches.map((patch) => patch.preview).filter(Boolean)]
    .filter((path) => !byPath.has(path)).sort();
  const drawingFiles = [...references].map((path) => byPath.get(path)).filter(Boolean);
  const previewPaths = new Set(patches.map((patch) => patch.preview).filter(Boolean));
  const previews = [...previewPaths].map((path) => byPath.get(path)).filter(Boolean);
  const supplied = files.filter((file) => file.path.startsWith('supplied/'));
  const metadata = files.filter((file) => !file.path.includes('/'));
  const sourceBytes = patches.reduce((n, patch) => n + patch.bytes, 0);
  const storedBytes = totalBytes(drawingFiles);
  const byCollection = Object.fromEntries(manifest.collections.map((collection) => [collection.id, {
    designs: patches.filter((patch) => patch.collection === collection.id).length,
    cards: patches.filter((patch) => patch.collection === collection.id && isCard(patch)).length,
    organizations: manifest.orgs.filter((org) => org.patches.some((patch) => patch.collection === collection.id)).length,
  }]));
  const summaryMismatches = [];
  for (const [key, actual] of Object.entries({ designs: patches.length, orgs: manifest.orgs.length, sourceBytes, storedBytes })) {
    if (manifest.summary[key] !== actual) summaryMismatches.push({ key, recorded: manifest.summary[key], actual });
  }
  const sharedFiles = [...manifest.shared.blocks, ...manifest.shared.bundles].map((part) => byPath.get(part.file)).filter(Boolean);
  const generatedPaths = new Set([...references, ...previewPaths]);
  const unreferencedGeneratedFiles = files.filter((file) => file.path.includes('/') && !file.path.startsWith('supplied/') && !generatedPaths.has(file.path))
    .map((file) => file.path);
  const pathsPerFamily = new Map();
  for (const patch of patches) {
    if (!patch.family) continue;
    if (!pathsPerFamily.has(patch.family)) pathsPerFamily.set(patch.family, []);
    pathsPerFamily.get(patch.family).push(patch);
  }

  return {
    version: 1,
    manifestSha256: hash(manifestBytes),
    templateCatalogueSha256: hash(templateBytes),
    counts: {
      designs: patches.length,
      cards: patches.filter(isCard).length,
      organizations: manifest.orgs.length,
      byCollection,
      variantGroups: variants.length,
      variantMembers: variants.reduce((n, group) => n + group.members.length, 0),
      excluded: manifest.excluded.length,
      mergedAliases: manifest.merged.length,
      absorbedAliases: (manifest.absorbed ?? []).length,
      templateFamilies: templates.length,
      templateMembers: classified.size,
      unclassifiedDesigns: patches.filter((patch) => !classified.has(patch.id)).length,
    },
    artwork: {
      reconstructedBytes: sourceBytes,
      storedBytes,
      bytesSavedBySharing: sourceBytes - storedBytes,
      percentSavedBySharing: sourceBytes ? Math.round((1 - storedBytes / sourceBytes) * 10000) / 100 : 0,
      storedDesignFiles: { files: patches.length, bytes: totalBytes(patches.map((patch) => byPath.get(patch.svg)).filter(Boolean)) },
      shared: {
        blocks: manifest.shared.blocks.length,
        bundles: manifest.shared.bundles.length,
        paths: manifest.shared.bundles.reduce((n, bundle) => n + bundle.paths, 0),
        bytes: totalBytes(sharedFiles),
        largest: sharedFiles.slice().sort((a, b) => b.bytes - a.bytes || (a.path < b.path ? -1 : 1)).slice(0, 10),
      },
    },
    previews: duplicateContent(library, previews),
    retainedSourcePackages: { files: supplied.length, bytes: totalBytes(supplied) },
    metadata: { files: metadata.length, bytes: totalBytes(metadata) },
    allLibraryFiles: { files: files.length, bytes: totalBytes(files) },
    variants: variants.map((group) => ({ id: group.id, label: group.label, members: group.members })),
    templates: templates.map((family) => ({ id: family.id, label: family.label, members: family.members })),
    repeatedUngroupedAtlasFamilies: [...pathsPerFamily]
      .filter(([, members]) => members.length > 1 && members.some((patch) => !patch.group))
      .map(([family, members]) => ({ family, ids: members.map((patch) => patch.id) })),
    checks: { missingFiles: [...new Set(missingFiles)], summaryMismatches, unreferencedGeneratedFiles },
    notes: [
      'Artwork counts are logical reconstructed SVG bytes and actual stored file bytes, not compressed HTTP transfer or Git pack size.',
      'Preview duplicates report identical bytes only; shared appearance does not establish identical historical specimens.',
      'Source packages retain editable artwork, references and review records; their bytes are not loaded by the library asset globs.',
      'Eager URL imports register asset addresses. SVG and shared-component bodies are fetched when a drawing opens.',
      'Run library:verify separately to verify reconstructed SVG hashes. Family matches are review candidates, not proof of one template.',
    ],
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    const args = process.argv.slice(2);
    let library = DEFAULT_LIBRARY;
    if (args.length) {
      if (args.length !== 2 || args[0] !== '--library') throw new Error('Usage: audit-library.mjs [--library <directory>]');
      library = resolve(args[1]);
    }
    const report = auditLibrary(library);
    console.log(JSON.stringify(report, null, 2));
    if (Object.values(report.checks).some((issues) => issues.length)) process.exitCode = 1;
  } catch (error) {
    console.error(error.message ?? error);
    process.exitCode = 1;
  }
}
