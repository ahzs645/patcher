#!/usr/bin/env node
// Sew library patches in a real browser and report on each: a regression check for the digitizer
// and renderer, and the way to compare a change by eye.
//
//   npm run sew:check                                  # every patch, default settings
//   npm run sew:check -- --ids S31-O01,S25-O05         # some patches
//   npm run sew:check -- --params '{"ground":"cloth"}' # any DigitizeParams
//   npm run sew:check -- --out before                  # where the PNGs and report.json go (default .cache/sew-check)
//   npm run sew:check -- --no-png                      # numbers only
//   npm run sew:check -- --profiles                    # with each patch's profile (library/profiles.json)
//
// Run it before and after a change with two --out folders, then compare the folders' report.json
// (stitch counts by kind, raised share, timings) and the PNGs side by side.
//
// Digitizing rasterises the SVG with the browser's own renderer, so this needs one: Playwright with
// Chromium. It is not a dependency of this package. Install it (npm i -D playwright && npx playwright
// install chromium) or point NODE_PATH at a global install. It exits 1 if any patch fails to sew or
// sews to nothing.

import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const out = resolve(opt('out', join(root, '.cache/sew-check')));
const params = JSON.parse(opt('params', '{}'));
const wantPng = !args.includes('--no-png');
const useProfiles = args.includes('--profiles');
const only = opt('ids', '')?.split(',').filter(Boolean);

let chromium;
try {
  ({ chromium } = createRequire(import.meta.url)('playwright'));
} catch {
  console.error('sew:check needs Playwright (npm i -D playwright && npx playwright install chromium).');
  process.exit(2);
}

mkdirSync(out, { recursive: true });
// No file watching: an edit made while this runs must not reload the page under it.
const server = await createServer({ root, logLevel: 'error', server: { port: 0, host: '127.0.0.1', hmr: false, watch: null } });
await server.listen();
const { port } = server.httpServer.address();
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${port}/`);

const ids = await page.evaluate(async (only) => {
  const L = await import('/src/library.ts');
  const all = L.LIBRARY.orgs.flatMap((o) => o.patches.map((p) => p.id));
  return only.length ? only : all;
}, only);

const report = [];
let failed = 0;
for (const id of ids) {
  const r = await page.evaluate(async ({ id, params, wantPng, useProfiles }) => {
    try {
      const P = await import('/src/index.ts');
      const L = await import('/src/library.ts');
      const patch = L.findPatch(id);
      if (!patch) return { error: 'not in the library' };
      const svg = await L.loadPatchSvg(patch);
      const digitizer = P.createDigitizer({ worker: false });
      const t = performance.now();
      const profile = useProfiles ? P.profileOf(id) : null;
      const res = await digitizer.digitize(svg, { ...profile?.params, ...params });
      const ms = Math.round(performance.now() - t);
      const kinds = {};
      let longest = 0;
      for (const b of res.blocks) {
        const k = b.kind + (b.raised ? '+raised' : '');
        kinds[k] = (kinds[k] || 0) + b.points.length / 2;
        const jumps = new Set(b.jumps);
        for (let i = 1; i < b.points.length / 2; i++) {
          if (jumps.has(i)) continue;
          longest = Math.max(longest, Math.hypot(b.points[i * 2] - b.points[i * 2 - 2], b.points[i * 2 + 1] - b.points[i * 2 - 1]));
        }
      }
      let png = null;
      if (wantPng) {
        png = P.renderTextured(res, { scale: 10, lightDeg: 225, colors: P.threadColors(profile, res.palette), borderColor: P.threadColor(profile, res.borderColor), dropShadow: true, finish: 'matte' }).toDataURL('image/png');
      }
      return {
        ms, stitches: res.stitchCount, threads: res.palette.length, kinds,
        raised: +res.raisedShare.reduce((s, x, i) => s + x * res.coverage[i], 0).toFixed(3),
        cloth: res.clothIndex >= 0 ? res.palette[res.clothIndex] : null,
        longestStitchMm: +longest.toFixed(1), png,
      };
    } catch (e) {
      return { error: String(e?.message ?? e) };
    }
  }, { id, params, wantPng, useProfiles });
  if (r.png) writeFileSync(join(out, `${id}.png`), Buffer.from(r.png.split(',')[1], 'base64'));
  delete r.png;
  const bad = r.error || !r.stitches;
  if (bad) failed++;
  report.push({ id, ...r });
  console.log(`${bad ? 'FAIL' : 'ok  '} ${id.padEnd(34)} ${r.error ?? `${String(r.stitches).padStart(6)} st  ${String(r.ms).padStart(5)} ms  raised ${(r.raised * 100).toFixed(0).padStart(2)}%  longest ${r.longestStitchMm} mm`}`);
}
writeFileSync(join(out, 'report.json'), JSON.stringify({ params, patches: report }, null, 1));
await browser.close();
await server.close();
console.log(`${ids.length - failed} of ${ids.length} sewn. Report: ${join(out, 'report.json')}`);
process.exit(failed ? 1 : 0);
