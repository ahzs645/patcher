#!/usr/bin/env node
// Reconstruct S56-O38 from geometric parts, without tracing the JPEG's pixel edges.
//
//   node library/supplied/bc-spca-roundel/compose.mjs
//   npm run library:import
//
// geometry.json controls the concentric rim/cloth circles, single equal-arm cross, and
// the two independent lettering arcs. source/atlas-S56-O38.svg supplies only the existing
// substitute letter outlines. Their new size, spacing, placement and rotations are computed
// here. No font installation, network access or atlas ZIP is required to rebuild the SVG.

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const geometry = JSON.parse(readFileSync(join(HERE, 'geometry.json'), 'utf8'));
const original = readFileSync(join(HERE, 'source/atlas-S56-O38.svg'), 'utf8');
const ORIGINAL_SHA = 'fc1abe7d50b32a2bad6ab7ba15c97f76306e1963314321a501cfdcb153d3610b';
if (createHash('sha256').update(original).digest('hex') !== ORIGINAL_SHA) {
  throw new Error('The recorded atlas lettering source has changed; review the source before rebuilding.');
}

const n = (value) => Number(value.toFixed(5)).toString();
const radians = (degrees) => degrees * Math.PI / 180;
const { x: cx, y: cy } = geometry.centre;
const { ink, cloth } = geometry.colours;

// Filled paths rather than stroked rings: vector exporters and the stitch digitizer see
// exactly the same two silhouettes. The cross is one closed polygon with no overlap seams.
function circle(radius) {
  return `M ${n(cx - radius)} ${cy} A ${radius} ${radius} 0 1 0 ${n(cx + radius)} ${cy} A ${radius} ${radius} 0 1 0 ${n(cx - radius)} ${cy} Z`;
}

function cross() {
  const { width, bar, centreY } = geometry.cross;
  const left = n(cx - width / 2), right = n(cx + width / 2);
  const top = n(centreY - width / 2), bottom = n(centreY + width / 2);
  const xl = n(cx - bar / 2), xr = n(cx + bar / 2);
  const yt = n(centreY - bar / 2), yb = n(centreY + bar / 2);
  return `M ${xl} ${top} H ${xr} V ${yt} H ${right} V ${yb} H ${xr} V ${bottom} H ${xl} V ${yb} H ${left} V ${yt} H ${xl} Z`;
}

function glyphs(caption) {
  const group = original.split(`<g data-caption="${caption}">`)[1]?.split('</g>')[0];
  if (!group) throw new Error(`Missing source caption: ${caption}`);
  const letters = [...caption.replaceAll(' ', '')];
  const paths = [...group.matchAll(/<path d="([^"]+)"[^>]+translate\(([-\d.]+) 0\)"\s*\/>/g)];
  if (paths.length !== letters.length) throw new Error(`Incomplete source lettering for ${caption}`);
  return paths.map((match, i) => ({ letter: letters[i], path: match[1], advance: -2 * Number(match[2]) }));
}

function caption(config, lower = false) {
  const letters = glyphs(config.caption);
  const scale = config.capHeight / config.capUnits;
  const wordBreaks = new Set();
  let index = -1;
  for (const ch of config.caption) {
    if (ch === ' ') wordBreaks.add(index);
    else index += 1;
  }
  // Distribute by each glyph's advance width; I is not allocated as much arc as M.
  const steps = letters.slice(1).map((glyph, i) =>
    (letters[i].advance + glyph.advance) / 2 * scale +
    (wordBreaks.has(i) ? config.wordSpace : 0));
  const span = radians(config.lastAngle - config.firstAngle) * config.radius;
  const tracking = (span - steps.reduce((sum, step) => sum + step, 0)) / steps.length;
  let along = radians(config.firstAngle) * config.radius;
  const paths = letters.map((glyph, i) => {
    if (i) along += steps[i - 1] + tracking;
    const theta = along / config.radius;
    const x = cx + config.radius * Math.sin(theta);
    const y = lower
      ? config.baselineY - config.radius + config.radius * Math.cos(theta)
      : cy - config.radius * Math.cos(theta);
    const angle = theta * 180 / Math.PI * (lower ? -1 : 1);
    return `    <path data-letter="${glyph.letter}" d="${glyph.path}" transform="translate(${n(x)} ${n(y)}) rotate(${n(angle)}) scale(${n(scale)} ${n(-scale)}) translate(${n(-glyph.advance / 2)} 0)"/>`;
  });
  return `  <g data-caption="${config.caption}" fill="${ink}">\n${paths.join('\n')}\n  </g>`;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${geometry.canvas} ${geometry.canvas}" role="img" aria-labelledby="spca-title spca-description">
  <title id="spca-title">British Columbia / SPCA — reconstructed cross roundel</title>
  <desc id="spca-description">Reference-based reconstruction of S56-O38: concentric circular rim and cool grey cloth field, a single equal-arm navy cross, taller BRITISH COLUMBIA lettering and a shallow lower SPCA arc. Existing substitute letter outlines are repositioned geometrically. The 66 by 55 pixel reference cannot establish the exact typeface, thread colours or physical dimensions.</desc>
  <path data-component="outer-border" fill="${ink}" d="${circle(geometry.radius)}"/>
  <path data-component="cloth-field" fill="${cloth}" d="${circle(geometry.radius - geometry.rimWidth)}"/>
  <path data-component="spca-cross-charge" fill="${ink}" d="${cross()}"/>
${caption(geometry.upper)}
${caption(geometry.lower, true)}
</svg>
`;

mkdirSync(join(HERE, 'composed'), { recursive: true });
writeFileSync(join(HERE, 'composed/S56-O38.svg'), svg);
console.log(`composed/S56-O38.svg: ${Buffer.byteLength(svg)} bytes`);
