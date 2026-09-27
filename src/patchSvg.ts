// "Patch SVG": the original vector art placed on the finished patch, with
// the border drawn as a vector stroke along the traced cut edge — the flat
// style used by patch illustrations such as those on Wikimedia Commons.

import type { DigitizeParams, DigitizeResult } from './types';
import type { LoadedSvg } from './svg';

const f = (v: number) => (Math.round(v * 100) / 100).toString();

export function buildPatchSvg(
  svg: LoadedSvg,
  params: DigitizeParams,
  result: DigitizeResult | null,
  borderColor: string | null,
  padMm: number,
): string {
  const artW = params.widthMm, artH = params.widthMm * svg.aspect;
  const W = artW + padMm * 2, H = artH + padMm * 2;

  // Nest the original document as an inner <svg> positioned on the patch.
  const inner = svg.text
    .replace(/^<\?xml[^>]*>\s*/, '')
    .replace(/<svg\b([^>]*)>/, (_m, attrs: string) =>
      `<svg${attrs.replace(/\s(width|height|x|y)="[^"]*"/g, '')} x="${f(padMm)}" y="${f(padMm)}" width="${f(artW)}" height="${f(artH)}">`);

  let edge = '';
  if (result && borderColor && params.border !== 'none') {
    const d = result.outlines
      .map((o) => {
        let s = `M${f(o[0])} ${f(o[1])}`;
        for (let i = 2; i < o.length; i += 2) s += `L${f(o[i])} ${f(o[i + 1])}`;
        return s + 'Z';
      })
      .join('');
    // The border rides on the cut edge, mostly inside it; clip keeps the
    // stroke's inner half and adds a slim outer lip.
    const bw = params.borderWidthMm;
    const inset = params.border === 'merrow' ? 0.8 : 1;
    const outset = params.border === 'merrow' ? 0.25 : 0.05;
    edge = `
  <defs>
    <clipPath id="patch-in"><path d="${d}"/></clipPath>
  </defs>
  <g fill="none" stroke-linejoin="round">
    <path d="${d}" stroke="${borderColor}" stroke-width="${f(bw * inset * 2)}" clip-path="url(#patch-in)"/>
    <path d="${d}" stroke="${borderColor}" stroke-width="${f(bw * outset * 2)}"/>
    <path d="${d}" stroke="rgba(0,0,0,.35)" stroke-width="0.25"/>
  </g>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${f(W)} ${f(H)}" width="${f(W)}mm" height="${f(H)}mm">
  ${inner}${edge}
</svg>`;
}
