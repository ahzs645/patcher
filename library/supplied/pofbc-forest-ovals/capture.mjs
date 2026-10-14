#!/usr/bin/env node
// Render PofBC's Forest Oval designs and their variants (Internal Logos → Forests) to SVG files
// with the lettering outlined, for the patch library.
//
//   1. In a PofBC checkout, run its dev server:  npx vite --port 5190
//   2. node library/supplied/pofbc-forest-ovals/capture.mjs [http://localhost:5190] [path/to/PofBC]
//
// Each variant is rendered the way PofBC's Internal Logos view renders it (same engine, recipe
// options, themes and colours; the Airtanker composition; the mountain lines on the single-colour
// tree oval), in a real browser so the letters are laid out along their curves by the browser's
// own text engine. Each letter's position and angle are then read back and the letter is drawn
// from the same font file the page used (fontkit), so the result needs no font. Two variants set
// wording the presets don't have, through the engine's own content fields: FIRE CONTROL on the
// Wildfire Management ribbon, and "Ministry of Forests" on the long ministry oval.

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER = process.argv[2] ?? 'http://localhost:5190';
const POFBC = process.argv[3] ?? join(HERE, '../../../../PofBC');
const require = createRequire(join(POFBC, 'package.json'));
const fontkit = require('fontkit');
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');

const oneInk = (foreground, background) => ({
  ink: foreground, paper: background, text: foreground, sky: background,
  water: background, wildlife: foreground, distant: background,
  earth: foreground, tree: foreground, word: foreground,
  descriptor: foreground, strip: foreground, stripText: background,
});

/** The variants, as PofBC's forestLogos.js defines them, plus the two new wordings. */
export const VARIANTS = [
  { file: 'forest-service/colour', preset: 'forest-service' },
  { file: 'forest-service/black', preset: 'forest-service', theme: 'mono' },
  { file: 'forest-service/green', preset: 'forest-service', theme: 'mono', colours: oneInk('#008450', '#ffffff') },
  { file: 'forest-service/reversed', preset: 'forest-service', theme: 'mono', colours: oneInk('#ffffff', '#008450') },
  { file: 'forest-service/black-gold', preset: 'forest-service', theme: 'mono', colours: oneInk('#FFCA05', '#000000') },
  { file: 'forest-service/navy-gold', preset: 'forest-service', theme: 'mono', colours: oneInk('#FFCA05', '#002950') },
  { file: 'forest-service/wildfire-management', preset: 'wildfire-management' },
  { file: 'forest-service/wildfire-management-black', preset: 'wildfire-management', theme: 'mono' },
  { file: 'forest-service/fire-control', preset: 'wildfire-management', content: { service: 'FIRE CONTROL' } },
  { file: 'forest-service/airtanker', preset: 'airtanker', composition: 'airtanker-package' },
  { file: 'forests/colour', preset: 'forests' },
  { file: 'forests/black', preset: 'forests', theme: 'mono' },
  { file: 'forests/green', preset: 'forests', theme: 'mono', colours: oneInk('#008450', '#ffffff') },
  { file: 'forests/reversed', preset: 'forests', theme: 'mono', colours: oneInk('#ffffff', '#008450') },
  { file: 'forests/wildfire', preset: 'forests-wildfire' },
  { file: 'long-ministry/colour', preset: 'long-ministry' },
  { file: 'long-ministry/black', preset: 'long-ministry', theme: 'mono' },
  { file: 'long-ministry/green', preset: 'long-ministry', theme: 'mono', colours: oneInk('#008450', '#ffffff') },
  { file: 'long-ministry/reversed', preset: 'long-ministry', theme: 'mono', colours: oneInk('#ffffff', '#008450') },
  { file: 'long-ministry/wildfire', preset: 'long-wildfire' },
  { file: 'long-ministry/ministry-of-forests', preset: 'long-ministry', content: { lower: 'Ministry of Forests' } },
];

/** The font file behind each Forest Oval face (as live-lettering/src/fonts.ts loads them). */
const FONTS = {
  'kabel-black': ['vendor/forestoval/bc-ministry-primitives-v5/fonts/Kabel-Black.otf'],
  'noto-condensed': ['node_modules/@fontsource-variable/noto-sans/files/noto-sans-latin-wdth-normal.woff2', { wdth: 75, wght: 800 }],
  'open-heavy': ['node_modules/@fontsource/open-sans/files/open-sans-latin-800-normal.woff2'],
  'open-bold': ['node_modules/@fontsource/open-sans/files/open-sans-latin-700-normal.woff2'],
  'condensed-bold': ['node_modules/@fontsource/roboto-condensed/files/roboto-condensed-latin-700-normal.woff2'],
  'condensed-heavy': ['node_modules/@fontsource/roboto-condensed/files/roboto-condensed-latin-800-normal.woff2'],
  'inter-black': ['node_modules/@fontsource/inter/files/inter-latin-900-normal.woff2'],
  'slab-bold': ['node_modules/@fontsource/roboto-slab/files/roboto-slab-latin-700-normal.woff2'],
  'slab-medium': ['node_modules/@fontsource/roboto-slab/files/roboto-slab-latin-500-normal.woff2'],
  'sans-regular': ['node_modules/@fontsource/roboto/files/roboto-latin-400-normal.woff2'],
  'sans-bold': ['node_modules/@fontsource/roboto/files/roboto-latin-700-normal.woff2'],
  'raleway-black': ['node_modules/@fontsource/raleway/files/raleway-latin-900-normal.woff2'],
};
const fonts = new Map();
function fontFor(face) {
  if (!fonts.has(face)) {
    const [file, variation] = FONTS[face] ?? [];
    if (!file) throw new Error(`No font file for face "${face}"`);
    let path = join(POFBC, file);
    if (variation) {
      // fontkit can't instance a WOFF2 variable font, so fontTools makes the static instance the
      // browser drew (pip install fonttools brotli).
      const out = join(mkdtempSync(join(tmpdir(), 'oval-font-')), `${face}.ttf`);
      const axes = Object.entries(variation).map(([axis, value]) => `${axis}=${value}`);
      execFileSync('python3', ['-c', [
        'import sys',
        'from fontTools.ttLib import TTFont',
        'from fontTools.varLib.instancer import instantiateVariableFont',
        'font = TTFont(sys.argv[1])',
        'axes = dict((a.split("=")[0], float(a.split("=")[1])) for a in sys.argv[3:])',
        'static = instantiateVariableFont(font, axes)',
        'static.flavor = None',
        'static.save(sys.argv[2])',
      ].join('\n'), path, out, ...axes]);
      path = out;
    }
    const font = fontkit.create(readFileSync(path));
    fonts.set(face, { font, unitsPerEm: font.unitsPerEm });
  }
  return fonts.get(face);
}

const r = (n) => Math.round(n * 1000) / 1000;

/** Replace each placeholder with the run's letters as paths, in the run's own coordinates. */
function outline(markup, runs) {
  return markup.replace(/<g data-outline-run="(\d+)"[^>]*?\/>/g, (_m, index) => {
    const run = runs[Number(index)];
    const { font, unitsPerEm } = fontFor(run.face);
    const k = run.size / unitsPerEm;
    const letters = run.chars.filter(({ c }) => c.trim()).map(({ c, x, y, rotate }) => {
      const glyph = font.glyphForCodePoint(c.codePointAt(0));
      const d = glyph.path.toSVG();
      if (!d) return '';
      return `<path data-char="${c.replace(/[&<>"]/g, '')}" transform="translate(${r(x)} ${r(y)}) rotate(${r(rotate)}) scale(${r(k * 1e4) / 1e4} ${r(-k * 1e4) / 1e4})" d="${d}"/>`;
    }).join('');
    const attrs = Object.entries(run.attrs).map(([name, value]) => `${name}="${value}"`).join(' ');
    return `<g ${attrs}>${letters}</g>`;
  });
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 1200 } });
page.on('pageerror', (e) => console.error('page:', e.message));
await page.goto(`${SERVER}/?view=internal&internal=forests`);
await page.waitForTimeout(2000);

for (const variant of VARIANTS) {
  const captured = await page.evaluate(async (v) => {
    const { loadLetteringRuntime } = await import('/vendor/forestoval/shared-primitives/live-lettering/src/runtime.ts');
    const runtime = await loadLetteringRuntime();
    const { P, E } = runtime;
    const [kabel] = await E.ensureFonts(['kabel-black'], false);
    const state = E.recipeState(v.preset, {
      textFit: 'reference-calibrated',
      treeLettering: kabel?.status === 'ready' ? 'kabel-black' : 'reference-v2',
      autoProfile: true, separatorPlacement: 'follow-text', fanOut: true, centreInRing: true,
    });
    if (v.content) state.content = { ...state.content, ...v.content };
    let result = await E.render({ ...state, ...(v.theme ? { theme: v.theme } : {}), ...(v.colours ? { colours: v.colours } : {}) });
    if (v.composition === 'airtanker-package') {
      const { AIRTANKER } = await import('/vendor/forestoval/shared-primitives/live-lettering/src/badges/airtanker.ts');
      result = await AIRTANKER.compose(result, runtime, null);
    }
    const { svg } = result;
    if (v.composition) {
      const ids = new Set();
      for (const el of svg.querySelectorAll('[id]')) { if (ids.has(el.id)) el.removeAttribute('id'); else ids.add(el.id); }
    }
    if (v.preset === 'forest-service' && v.theme === 'mono') {
      // As InternalLogosView's addMountainLines: the supplied ridge and base lines behind the tree.
      const ink = result.state.colours.ink ?? P.THEMES[result.state.theme].ink;
      const parser = new DOMParser();
      const source = parser.parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${E.ART.treeInner}</svg>`, 'image/svg+xml');
      const mountain = source.querySelector('path[fill="#0091c4"]');
      const target = [...svg.querySelectorAll('[data-layer="scene"] path, defs [data-primitive="scene-tree"] path')]
        .find((p) => p.getAttribute('d') === mountain?.getAttribute('d'));
      if (target) {
        const raws = await Promise.all([
          import('/vendor/forestoval/shared-primitives/bc-ministry-v5/scenes/tree-parts/mountain-ridge.svg?raw'),
          import('/vendor/forestoval/shared-primitives/bc-ministry-v5/scenes/tree-parts/mountain-base.svg?raw'),
        ]);
        target.after(...raws.map(({ default: raw }) => {
          const path = document.importNode(parser.parseFromString(raw, 'image/svg+xml').querySelector('path'), true);
          path.removeAttribute('id');
          path.setAttribute('stroke', ink);
          path.setAttribute('data-primitive', 'mountain-line');
          return path;
        }));
      }
    }
    svg.querySelectorAll('[data-live-text]').forEach((run) => { run.removeAttribute('tabindex'); run.removeAttribute('role'); });
    // Lay it out on the page, so the browser places every letter.
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:0;top:0;width:900px;opacity:0;pointer-events:none';
    host.append(svg);
    document.body.append(host);
    await document.fonts.ready;
    const runs = [];
    for (const text of [...svg.querySelectorAll('text')]) {
      const n = text.getNumberOfChars();
      const content = text.textContent;
      const chars = [];
      for (let i = 0; i < n; i++) {
        const c = content[i];
        let pos;
        try { pos = text.getStartPositionOfChar(i); } catch { continue; }
        chars.push({ c, x: pos.x, y: pos.y, rotate: text.getRotationOfChar(i) });
      }
      const keep = {};
      for (const name of ['fill', 'data-slot', 'data-role', 'data-face', 'data-live-text', 'transform', 'opacity']) {
        if (text.hasAttribute(name)) keep[name] = text.getAttribute(name);
      }
      runs.push({ face: text.getAttribute('data-face'), size: parseFloat(text.getAttribute('font-size')), attrs: keep, chars, content });
      const placeholder = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      placeholder.setAttribute('data-outline-run', String(runs.length - 1));
      text.replaceWith(placeholder);
    }
    // The text-path baselines aren't drawn and aren't needed any more.
    svg.querySelectorAll('path[id$="-baseline"]').forEach((p) => p.remove());
    svg.removeAttribute('aria-labelledby');
    const markup = new XMLSerializer().serializeToString(svg);
    host.remove();
    return { markup, runs };
  }, variant);
  const out = outline(captured.markup, captured.runs);
  if (/<text\b|textPath/.test(out)) throw new Error(`${variant.file}: text left in the output`);
  mkdirSync(join(HERE, dirname(variant.file)), { recursive: true });
  writeFileSync(join(HERE, `${variant.file}.svg`), out);
  console.log(`${variant.file}.svg  ${out.length} bytes, ${captured.runs.map((run) => run.content).join(' / ')}`);
}
await browser.close();
