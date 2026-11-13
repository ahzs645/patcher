#!/usr/bin/env node
// Rebuild S56-O23 from the retained Expo logo and outlined atlas-style letters.
// No fonts, atlas download, image tracing or external SVG references are needed.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const logo = readFileSync(join(HERE, 'source/expo86-symbol.svg'));
const logoSha = createHash('sha256').update(logo).digest('hex');
const EXPECTED_LOGO_SHA = '3f51b5e0355222bd5399fc5e35ece3c4204c8527681d20f0385a8825bec5a1c7';
if (logoSha !== EXPECTED_LOGO_SHA) throw new Error('The retained PofBC Expo logo changed; review its provenance and placement before rebuilding.');
const { glyphs, capHeight } = JSON.parse(readFileSync(join(HERE, 'source/lettering.json'), 'utf8'));

const palette = { field: '#214986', edge: '#352e29', gold: '#c19a4f', lettering: '#b83969' };
const number = (value) => Number(value.toFixed(6));

// Centre each glyph by advance along a circular baseline, turning it with the
// tangent. These are layout choices read from the small photograph, not issue
// dimensions. The second caption remains a provisional transcription.
function caption(text, height, tracking, baseline, radius, provisional = false) {
  const scale = height / capHeight;
  const widths = [...text].map((char) => glyphs[char].advance * scale);
  const width = widths.reduce((sum, value) => sum + value, 0) + tracking * (text.length - 1);
  let along = -width / 2;
  const paths = [...text].map((char, i) => {
    const glyph = glyphs[char];
    const angle = (along + widths[i] / 2) / radius;
    const x = 37.5 + radius * Math.sin(angle);
    const y = baseline + radius * (1 - Math.cos(angle));
    along += widths[i] + tracking;
    return `    <path d="${glyph.d}" transform="translate(${number(x)} ${number(y)}) rotate(${number(angle * 180 / Math.PI)}) scale(${number(scale)} ${number(-scale)}) translate(${-glyph.advance / 2} 0)"/>`;
  });
  return `  <g data-caption="${text}"${provisional ? ' data-transcription="provisional"' : ''} fill="${palette.lettering}">\n${paths.join('\n')}\n  </g>`;
}

// The complete collected EXPO-over-86 lockup, including its custom EXPO letters.
// Recolour only: preserve all paths, line positions, stroke widths and aspect ratio.
const logoBody = /<svg\b[^>]*>([\s\S]*)<\/svg>/.exec(logo.toString('utf8'))?.[1];
if (!logoBody) throw new Error('The retained Expo file has no SVG body.');
const goldLogo = logoBody.replace(/\r\n/g, '\n').replace(/stroke="(?:#000000|#1F92CF)"/g, `stroke="${palette.gold}"`).trim();
const logoWidth = 23.0;
const logoScale = logoWidth / 263;
const logoX = (75 - logoWidth) / 2;
const logoY = 18.4;

// Constructed, symmetric version of the photograph's broad crown and tapered
// sides. A separate narrow gold border follows inside the dark cloth edging.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 75 57" role="img" aria-labelledby="expo-emergency-title expo-emergency-description">
  <title id="expo-emergency-title">Emergency Service / Expo 86 — shield</title>
  <desc id="expo-emergency-description">Reference-based reconstruction of S56-O23. EMERGENCY follows the visible upper caption; SERVICE is a provisional reading of the blurred second line. The gold stacked Expo 86 logo reuses PofBC's collected third-party vector, not an official manufacturing master.</desc>
  <g data-component="base-border" stroke-linejoin="round">
    <path d="M3.6 11.3 Q37.5 -7 71.4 11.3 Q72.4 12 71.6 14.1 L57.1 51.7 Q56.4 53.5 54.2 53.5 L20.8 53.5 Q18.6 53.5 17.9 51.7 L3.4 14.1 Q2.6 12 3.6 11.3 Z" fill="${palette.field}" stroke="${palette.edge}" stroke-width="2.6"/>
    <path d="M5.5 12.5 Q37.5 -3.3 69.5 12.5 L55.2 50.5 Q54.8 51.1 53.7 51.1 L21.3 51.1 Q20.2 51.1 19.8 50.5 Z" fill="none" stroke="${palette.gold}" stroke-width="1.15"/>
  </g>
${caption('EMERGENCY', 5.0, 1.1, 11.2, 65)}
${caption('SERVICE', 3.2, 0.45, 17.3, 100, true)}
  <g data-component="expo86-lockup" data-source="PofBC collected-expo-86-corporation / expo86-symbol.svg" data-source-sha256="${logoSha}" transform="translate(${number(logoX)} ${logoY}) scale(${number(logoScale)})">
${goldLogo}
  </g>
</svg>
`;

mkdirSync(join(HERE, 'composed'), { recursive: true });
writeFileSync(join(HERE, 'composed/S56-O23.svg'), svg);
console.log(`composed/S56-O23.svg: ${Buffer.byteLength(svg)} bytes; SHA-256 ${createHash('sha256').update(svg).digest('hex')}`);
