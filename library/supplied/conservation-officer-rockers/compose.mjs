import { readFileSync, writeFileSync } from 'node:fs';
import { glyphs } from './glyphs.mjs';

const caption = 'CONSERVATION OFFICER';
const characters = [...caption.replaceAll(' ', '')];

for (const id of ['MC19-O02', 'MC20-O02', 'S56-O40']) {
  const spec = JSON.parse(readFileSync(new URL(id + '.json', import.meta.url), 'utf8'));
  if (spec.letters.length !== characters.length) throw new Error('Incomplete caption for ' + id);
  const letters = characters.map((char, i) => {
    const [x, y, angle, scaleX, scaleY] = spec.letters[i];
    const [width, outline] = glyphs[char];
    return `    <path data-glyph="${char}" d="${outline}" transform="translate(${x} ${y}) rotate(${angle}) scale(${scaleX} ${scaleY}) translate(${-width / 2} -14)"/>`;
  });
  const edging = spec.edge ? ` stroke="${spec.edge}" stroke-width="${spec.edgeWidth}" stroke-linejoin="round"` : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${spec.viewBox}" role="img">
  <title>${spec.title}</title>
  <desc>Reconstruction from the ${spec.sourceCrop} photograph. Cloth cut, thread colours and stitched letterforms are approximate.</desc>
  <path data-component="rocker-outline" d="${spec.outline}" fill="${spec.ground}"${edging}/>
  <g data-caption="${caption}" fill="${spec.thread}" fill-rule="evenodd" stroke="${spec.thread}" stroke-width="${spec.letterStroke}" stroke-linejoin="round">
${letters.join('\n')}
  </g>
</svg>
`;
  writeFileSync(new URL(id + '.svg', import.meta.url), svg);
}
