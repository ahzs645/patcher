#!/usr/bin/env node
// Restore only the clearly visible heading divider and British Columbia placement.
// Inputs are frozen, joined pre-review SVGs: rebuilding after library import is safe.
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const baseline = JSON.parse(readFileSync(join(ROOT, 'source/baseline.json'), 'utf8'));
const sha = (text) => createHash('sha256').update(text).digest('hex');
const esc = (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const number = (n) => Number(n.toFixed(6)).toString();
const settings = {
  // Authored guides in the unchanged 100 × 100 master coordinates. No contour tracing.
  divider: { path: 'M5 24.8 Q50 7.6 95 24.8', width: 1.4 },
  britishColumbia: { centerX: 50, centerBaselineY: 25.8, curvature: 0.006, positionSpread: 1.18, glyphScale: 1.06 },
};
const sources = {
  'MC27-O01': { sourceId: 'MC27', url: 'https://moosecop.net/History/BC_CO_Min_of_Env_1st_version.jpg', dimensions: [323, 307], bbox: [2, 5, 320, 306] },
  'MC28-O01': { sourceId: 'MC28', url: 'https://moosecop.net/History/BC_CO_Min_of_Env_Parks.jpg', dimensions: [305, 306], bbox: [2, 2, 303, 305] },
  'MC29-O01': { sourceId: 'MC29', url: 'https://moosecop.net/History/BC_CO_Min_of_Env_2nd_version.jpg', dimensions: [304, 298], bbox: [2, 1, 303, 297] },
};

// Preview generation is optional; the SVG build has no third-party dependencies.
// Supply an existing installation with --resvg-module /absolute/path/to/package.
const previewFlag = process.argv.indexOf('--resvg-module');
const require = createRequire(import.meta.url);
const resvgModule = previewFlag >= 0 ? resolve(process.argv[previewFlag + 1]) : null;
const Resvg = resvgModule ? require(resvgModule).Resvg : null;
const records = [];
for (const item of baseline.patches) {
  let svg = readFileSync(join(ROOT, 'source', `${item.id}-original.svg`), 'utf8');
  if (sha(svg) !== item.sha256) throw new Error(`${item.id}: baseline hash changed`);
  const original = svg;
  const ink = /data-component="bc-framed-provincial-mark"[\s\S]*?<g[^>]*fill="([^"]+)"/.exec(svg)?.[1];
  if (!ink) throw new Error(`${item.id}: cannot read unchanged ink palette`);
  const anchor = '<g data-component="bc-framed-provincial-mark"';
  if (!svg.includes(anchor)) throw new Error(`${item.id}: missing boxed crest anchor`);
  svg = svg.replace(anchor, `<path data-component="source-review-heading-divider" d="${settings.divider.path}" fill="none" stroke="${ink}" stroke-width="${settings.divider.width}" stroke-linecap="round"/>${anchor}`);
  const glyphs = [];
  let captionFound = false;
  svg = svg.replace(/<g data-caption="BRITISH COLUMBIA">([\s\S]*?)<\/g>/, (_group, paths) => {
    captionFound = true;
    const guide = settings.britishColumbia;
    const moved = paths.replace(/transform="translate\(([-\d.]+) ([-\d.]+)\) rotate\(([-\d.]+)\) scale\(([-\d.]+) ([-\d.]+)\) translate\(([-\d.]+) ([-\d.]+)\)"/g,
      (_m, oldX, _oldY, _oldAngle, sx, sy, glyphX, glyphY) => {
        if (Math.abs(Number(sx) + Number(sy)) > 0.0000001) throw new Error('Expected uniform glyph scale');
        const x = guide.centerX + (Number(oldX) - guide.centerX) * guide.positionSpread;
        const dx = x - guide.centerX;
        const y = guide.centerBaselineY + guide.curvature * dx * dx;
        const angle = Math.atan(2 * guide.curvature * dx) * 180 / Math.PI;
        const scale = Number(sx) * guide.glyphScale;
        glyphs.push({ x, y, angle, scale });
        return `transform="translate(${number(x)} ${number(y)}) rotate(${number(angle)}) scale(${number(scale)} ${number(-scale)}) translate(${glyphX} ${glyphY})"`;
      });
    if (glyphs.length !== 15) throw new Error(`${item.id}: expected 15 British Columbia glyphs, got ${glyphs.length}`);
    return `<g data-caption="BRITISH COLUMBIA" data-live-text="BRITISH COLUMBIA" data-review-layout="independent-source-arc">${moved}</g>`;
  });
  if (!captionFound) throw new Error(`${item.id}: heading not found`);
  // The original whole-master hash would be false after a geometry change.
  svg = svg.replace(/ data-master-geometry-hash="[^"]+"/g, '')
    .replace(/data-master-id="[^"]+"/, `data-master-id="co-compact-heading-review-v1-${item.id}"`);
  const description = 'Partial source-based refinement: restored curved heading divider and independently fitted British Columbia row. Existing glyph outlines, outer cut, boxed arms, ministry captions and palette remain interpretations. Not authenticated issue artwork or an embroidery production master.';
  svg = svg.replace(/<desc>[\s\S]*?<\/desc>/, `<desc>${description}</desc>`);
  const metadata = {
    id: item.id, review: 'co-compact-heading-review-v1', source: sources[item.id],
    baselinePatcherCommit: baseline.patcherCommit, baselineSvgSha256: item.sha256,
    operations: ['Add authored curved heading divider', 'Move and rotate unchanged British Columbia glyph outlines on an independent arc with uniform glyph scaling'],
    settings, glyphPositions: glyphs, limits: description,
  };
  svg = svg.replace(/<metadata>[\s\S]*?<\/metadata>/, `<metadata>${esc(JSON.stringify(metadata))}</metadata>`);
  writeFileSync(join(ROOT, `${item.id}.svg`), svg);
  if (Resvg) {
    for (const [name, contents] of [[item.id, svg], [`${item.id}-before`, original]]) {
      const png = new Resvg(contents, { fitTo: { mode: 'width', value: 660 } }).render().asPng();
      writeFileSync(join(ROOT, 'review', `${name}.png`), png);
    }
  }
  records.push({ ...metadata, svgSha256: sha(svg), bytes: Buffer.byteLength(svg) });
}
writeFileSync(join(ROOT, 'layout.json'), JSON.stringify({ settings, patches: records }, null, 2) + '\n');
console.log(`Built ${records.length} partial compact-shield refinements${Resvg ? ' and PNG comparisons' : ''}.`);
