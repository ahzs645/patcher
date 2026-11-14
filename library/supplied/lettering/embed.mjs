// Place one SVG's artwork inside another: its content, fitted into a box, as a group.
//
//   embed(svgText, { x, y, width, height, prefix: 'sfu-arms', align: 'centre' })
//
// The artwork keeps its aspect ratio and is centred in the box (or put at its top with align 'top').
// Its ids, and the url(#…) and href="#…" references to them, get the prefix so they can't clash with
// the host's. The XML declaration, title, desc and metadata are left behind.

const num = (v) => Number(v.toFixed(6)).toString();

export function viewBoxOf(svg) {
  const m = /<svg\b[^>]*\bviewBox="([^"]+)"/.exec(svg);
  if (!m) throw new Error('the artwork has no viewBox');
  const [x, y, w, h] = m[1].trim().split(/[\s,]+/).map(Number);
  return { x, y, w, h };
}

export function embed(svg, { x, y, width, height, prefix, align = 'centre', attrs = '' }) {
  const vb = viewBoxOf(svg);
  const scale = Math.min(width / vb.w, height / vb.h);
  const w = vb.w * scale;
  const h = vb.h * scale;
  const tx = x + (width - w) / 2 - vb.x * scale;
  const ty = (align === 'top' ? y : y + (height - h) / 2) - vb.y * scale;
  let body = svg
    .replace(/^[\s\S]*?<svg\b[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/<title>[\s\S]*?<\/title>|<desc>[\s\S]*?<\/desc>|<metadata>[\s\S]*?<\/metadata>/g, '');
  if (prefix) {
    const ids = [...body.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
    for (const id of ids) {
      const safe = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      body = body
        .replace(new RegExp(`\\bid="${safe}"`, 'g'), `id="${prefix}-${id}"`)
        .replace(new RegExp(`url\\(#${safe}\\)`, 'g'), `url(#${prefix}-${id})`)
        .replace(new RegExp(`href="#${safe}"`, 'g'), `href="#${prefix}-${id}"`);
    }
  }
  body = body.replace(/>\s+</g, '><').trim();
  return {
    svg: `<g${attrs ? ` ${attrs}` : ''} transform="translate(${num(tx)} ${num(ty)}) scale(${num(scale)})">${body}</g>`,
    box: { x: tx + vb.x * scale, y: ty + vb.y * scale, width: w, height: h },
  };
}
