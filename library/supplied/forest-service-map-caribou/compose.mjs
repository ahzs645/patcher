#!/usr/bin/env node
// Recompose S45 from the same emblem components used by S48, with this specimen's
// rectangular ground, outlined captions and a separately constructed animal.
// Run: node library/supplied/forest-service-map-caribou/compose.mjs /path/to/PofBC
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
if (!process.argv[2]) throw new Error('Supply the PofBC checkout containing src/internal/forest-service-emblem.svg.');
const emblem = readFileSync(join(resolve(process.argv[2]), 'src/internal/forest-service-emblem.svg'), 'utf8');
const lettering = readFileSync(join(HERE, 'source/lettering.svg'), 'utf8');
const colour = {
  field: '#225c40', border: '#356f4a', map: '#a8bf57', outline: '#713d30',
  tree: '#152819', body: '#aaa18a', pale: '#d4d5c1',
};
const xml = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const extract = (tag, id) => {
  const match = new RegExp(`<${tag} id="${id}"[^>]*\\/>`).exec(emblem);
  if (!match) throw new Error(`Missing canonical emblem component: ${id}`);
  return match[0].replace(/\s+/g, ' ').replace(`id="${id}"`, `data-source-component="${id}"`);
};
const mainland = extract('path', 'mainland');
const islands = ['island-north', 'island-middle', 'island-south'].map(id => extract('path', id));
const trunk = extract('rect', 'tree-trunk');
const crown = extract('polygon', 'tree-crown');
const caption = (text) => {
  const group = new RegExp(`<g[^>]*data-caption="${text.replaceAll('.', '\\.')}"[^>]*>[\\s\\S]*?<\\/g>`).exec(lettering)?.[0];
  if (!group) throw new Error(`Missing outlined caption: ${text}`);
  return group;
};

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 418 479" role="img" aria-labelledby="title description">
<title id="title">B.C. / Forest Service — evergreen emblem and caribou rectangle</title>
<desc id="description">Source-specific vector reconstruction of S45-O01. Mainland, three islands, evergreen crown and trunk reuse the PofBC Forest Service emblem also used in S48-O01; their placement and palette follow the rectangular specimen. The right-facing animal, identified as a caribou by the user, is manually constructed from smooth closed paths. The small photograph does not establish species, fine antler anatomy, original lettering, physical dimensions or calibrated thread colours. This is a refinement for review, not authenticated production artwork.</desc>
<metadata>${xml(JSON.stringify({
  sourceOccurrence: 'S45-O01', relatedEmblemPatch: 'S48-O01',
  emblemSource: 'https://github.com/ahzs645/PofBC/blob/33bcc62280b26d6e5f13725ac0d50b186d417cda/src/internal/forest-service-emblem.svg',
  emblemSha256: createHash('sha256').update(emblem).digest('hex'),
  sourcePixels: [418, 479], animalIdentification: 'caribou — user identification, 2026-11-14',
  lettering: 'Outlined substitute glyphs retained from atlas S45-O01; independently refitted.',
}))}</metadata>
<g data-component="cloth">
  <rect x="20" y="17" width="380" height="445" rx="30" fill="${colour.border}"/>
  <rect x="27" y="24" width="366" height="431" rx="23" fill="${colour.field}"/>
</g>
<g data-component="forest-service-emblem" data-related-patch="S48-O01">
  <g data-component="mainland" transform="translate(-123 -49) scale(.56 .48)" fill="${colour.map}" stroke="${colour.outline}" stroke-width="18" stroke-linejoin="round">
    ${mainland}
  </g>
  <g data-component="islands" transform="translate(-123 -49) scale(.56 .48)" fill="${colour.map}">
    ${islands[0]}${islands[1]}
    <g data-component="southern-island-fit" transform="translate(35.5 103) scale(.85)">${islands[2]}</g>
  </g>
  <g data-component="evergreen" transform="translate(16 -15) scale(.37 .41)" fill="${colour.tree}">
    <g data-component="tree-outline" stroke="${colour.outline}" stroke-width="20" stroke-linejoin="round">${trunk}${crown}</g>
    <g data-component="tree-fill">${trunk}${crown}</g>
  </g>
</g>
<g data-component="caribou" data-identification="user-provided" fill="${colour.body}">
  <!-- Far legs remain visible at the belly, without the old angular stick-figure joints. -->
  <path data-part="far-hind-leg" d="M151 264 C156 270 160 277 162 284 L161 302 Q160 306 155 305 L153 303 155 285 145 274 Z"/>
  <path data-part="far-foreleg" d="M225 261 Q231 268 234 277 L239 297 Q239 301 234 301 L231 298 228 281 216 270 Z"/>
  <path data-part="body" d="M143 244 C155 238 171 240 184 239 C201 238 213 232 227 233 C234 233 241 238 243 245 L240 261 C232 267 221 272 211 273 C194 275 176 270 162 272 C154 273 146 271 140 265 Q135 258 138 251 L132 249 Q125 245 126 239 Q127 236 131 239 L140 246 Z"/>
  <path data-part="near-hind-leg" fill="${colour.pale}" d="M145 258 C150 260 153 266 152 272 L147 283 137 294 134 303 Q132 307 127 304 L127 301 132 289 140 279 140 270 Z"/>
  <path data-part="near-foreleg" fill="${colour.pale}" d="M230 255 Q237 253 240 260 L236 277 235 295 Q234 299 230 298 L227 296 228 278 223 266 Z"/>
  <!-- Pale shoulder/neck and compact right-facing head, built independently of the body. -->
  <path data-part="neck-and-head" fill="${colour.pale}" d="M224 270 C225 258 222 248 227 235 C231 226 237 219 242 212 L243 205 Q240 201 238 195 Q238 192 242 194 L250 200 257 200 Q261 201 264 206 L276 208 Q279 209 277 213 L271 217 260 218 C254 226 253 238 250 251 L247 268 Q238 273 224 270 Z"/>
  <!-- Restrained forked antlers: the low-resolution source does not resolve a full rack. -->
  <path data-part="rear-antler" fill="${colour.pale}" d="M252 204 C252 197 250 192 247 188 L244 181 Q244 178 246 179 L250 184 253 192 257 186 260 182 Q263 181 262 184 L257 193 257 202 Z"/>
  <path data-part="front-antler" fill="${colour.pale}" d="M258 204 C262 198 264 193 264 188 L265 180 Q266 177 268 179 L268 187 273 184 278 179 Q281 179 279 182 L276 188 268 192 264 202 Z"/>
</g>
<g data-component="upper-lettering" transform="translate(-1 -5)">${caption('B.C.')}</g>
<g data-component="lower-lettering" transform="translate(12.54 0) scale(.94 1)">${caption('FOREST SERVICE')}</g>
</svg>\n`;
mkdirSync(join(HERE, 'composed'), { recursive: true });
writeFileSync(join(HERE, 'composed/S45-O01.svg'), svg);
console.log(`composed/S45-O01.svg: ${Buffer.byteLength(svg)} bytes; SHA-256 ${createHash('sha256').update(svg).digest('hex')}`);
