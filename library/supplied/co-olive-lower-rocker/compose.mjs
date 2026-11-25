// Independent vector construction, not a raster trace.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
export const outline = "M 32 3 C 38 2 42 6 49 12 C 87 42 131 58 185.5 59 C 240 58 284 42 322 12 C 329 6 333 2 339 3 C 347 3 353 10 359 18 C 367 28 371 37 367 44 C 365 48 361 52 356 56 C 312 94 251 115 185.5 115 C 120 115 59 94 15 56 C 10 52 6 48 4 44 C 0 37 4 28 12 18 C 18 10 24 3 32 3 Z";
export const glyphs = {
  "C": [
    12,
    "M12 5.8 9.7 7.2C9 4 8 2.6 6.1 2.6 3.2 2.6 2.6 6.6 2.6 14S3.2 25.4 6.1 25.4C8 25.4 9 23.8 9.7 20.8L12 22.2C11 26.4 9 28 6.1 28 1.4 28 0 23.4 0 14S1.4 0 6.1 0C9 0 11 1.6 12 5.8Z"
  ],
  "O": [
    13,
    "M6.5 0C11.4 0 13 4.7 13 14S11.4 28 6.5 28 0 23.3 0 14 1.6 0 6.5 0ZM6.5 2.6C3.5 2.6 2.6 6.2 2.6 14S3.5 25.4 6.5 25.4 10.4 21.8 10.4 14 9.5 2.6 6.5 2.6Z"
  ],
  "N": [
    13,
    "M0 0H2.7L10.4 22V0H13V28H10.3L2.6 6V28H0Z"
  ],
  "S": [
    12,
    "M11.8 5.7 9.4 6.7C8.8 3.8 7.7 2.6 5.9 2.6 3.8 2.6 2.8 4.3 2.8 7.1 2.8 10.4 4.4 11.5 6.8 13 10 14.9 12 16.9 12 21.1 12 25.4 9.8 28 6 28 2.8 28 .8 26.2 0 22L2.5 21.1C3 24.1 4 25.4 6 25.4 8.3 25.4 9.4 23.8 9.4 21.1 9.4 18 7.6 16.7 5.2 15.2 2.2 13.4 .2 11.4 .2 7.1 .2 2.8 2.4 0 5.9 0 9 0 11 1.8 11.8 5.7Z"
  ],
  "E": [
    11,
    "M0 0H11V2.6H2.6V12.4H9.2V15H2.6V25.4H11V28H0Z"
  ],
  "R": [
    13,
    "M0 0H5.7C10.5 0 12.5 2.8 12.5 8.3 12.5 12.8 10.9 15.1 8 15.9L13 28H10L5.1 16.5H2.6V28H0ZM2.6 2.6V13.9H5.6C8.5 13.9 9.9 12.2 9.9 8.3S8.5 2.6 5.6 2.6Z"
  ],
  "V": [
    13,
    "M0 0H2.8L6.5 22.6 10.2 0H13L7.9 28H5.1Z"
  ],
  "A": [
    13,
    "M5.1 0H7.9L13 28H10.3L9.1 21H3.9L2.7 28H0ZM4.4 18.4H8.6L6.5 5.9Z"
  ],
  "T": [
    13,
    "M0 0H13V2.6H7.8V28H5.2V2.6H0Z"
  ],
  "I": [
    2.7,
    "M0 0H2.7V28H0Z"
  ],
  "F": [
    11,
    "M0 0H11V2.6H2.6V12.4H9.2V15H2.6V28H0Z"
  ]
};
const caption = "CONSERVATION OFFICER";
const positions = [30,48,67,86,104,121,138,155,173,186,198,219,246,263,278,289,303,319,336];
const ground = '#626c55', gold = '#cfb258';
const f = v=>Number(v.toFixed(3));
export function compose() {
  const paths = [...caption.replaceAll(' ','')].map((c,i) => {
    const x=positions[i], y=84-0.00225*(x-185.5)**2, angle=Math.atan(-0.0045*(x-185.5))*180/Math.PI;
    const [width,d]=glyphs[c];
    return `    <path data-glyph="${c}" d="${d}" transform="translate(${f(x)} ${f(y)}) rotate(${f(angle)}) translate(${-width/2} -14)"/>`;
  }).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 371 118" role="img">\n  <title>Conservation Officer — separate olive lower rocker</title>\n  <desc>MC19-O02: independently constructed rounded U-shaped cloth outline and individually positioned original narrow capital glyphs. Reference-based interpretation; no raster or traced contours. Exact embroidery alphabet, thread colours and physical dimensions remain unverified.</desc>\n  <path data-component="lower-rocker-outline" fill="${ground}" d="${outline}"/>\n  <g data-live-text="${caption}" data-caption="${caption}" fill="${gold}" fill-rule="evenodd">\n${paths}\n  </g>\n</svg>\n`;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) writeFileSync(join(dirname(process.argv[1]), 'MC19-O02.svg'),compose());
