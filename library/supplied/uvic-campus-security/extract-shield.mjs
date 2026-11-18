// Cut the University of Victoria shield out of its full arms (source/UVic_CoA.svg); see the README.
//   node extract-shield.mjs source/UVic_CoA.svg source/uvic-shield.svg
// Needs Playwright with Chromium, which is not a dependency of this package: install it, or point
// NODE_PATH at a global install (as for npm run sew:check).
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [inp, out] = process.argv.slice(2);
let svg = readFileSync(inp, 'utf8').replace(/<\?xml[^>]*>|<!--[\s\S]*?-->|<!DOCTYPE[^>]*>/g, '');
const b = await chromium.launch(); const pg = await b.newPage();
await pg.setContent(`<body>${svg}</body>`);
const res = await pg.evaluate(() => {
  const root = document.querySelector('svg');
  // The chief's white field is an embedded PNG: put a white rectangle of the same box in its place.
  const img = root.querySelector('image');
  const ib = img.getBBox(); const ibox = img.getBoundingClientRect();
  const inv = root.getScreenCTM().inverse();
  const userBox = (el) => { const c = el.getBoundingClientRect(); const p0 = new DOMPoint(c.left, c.top).matrixTransform(inv); const p1 = new DOMPoint(c.right, c.bottom).matrixTransform(inv); return { x: p0.x, y: p0.y, width: p1.x - p0.x, height: p1.y - p0.y }; };
  const leaves = [...root.querySelectorAll('path,polygon,rect,polyline,line,circle,ellipse,image')];
  const blue = leaves.find((el) => el.getAttribute('fill') === '#0060A9' && userBox(el).width > 150);
  const bb = userBox(blue);
  const chief = userBox(img);
  const box = { x0: bb.x - 1.5, x1: bb.x + bb.width + 1.5, y0: chief.y - 1.5, y1: bb.y + bb.height + 1.5 };
  const kept = [];
  const order = leaves;
  const blueIdx = order.indexOf(blue);
  const chiefIdx = order.indexOf(img);
  // The middle martlet's black outline is part of the artwork's base linework, which shows through holes
  // in the chief's white raster. The three martlets are the same drawing: give the middle one the left
  // martlet's outline, moved by the offset between their red bodies.
  const near = (r, x, y) => Math.abs(r.x - x) < 0.3 && Math.abs(r.y - y) < 0.3;
  const leftOutline = order.find((el) => !el.getAttribute('fill') && near(userBox(el), 88.6, 271.6));
  const leftRed = order.find((el) => el.getAttribute('fill') === '#E4422B' && near(userBox(el), 92.0, 273.4));
  const midRed = order.find((el) => el.getAttribute('fill') === '#E4422B' && near(userBox(el), 139.1, 273.8));
  const lr = userBox(leftRed), mr = userBox(midRed);
  const midOutline = leftOutline.cloneNode(false);
  midOutline.removeAttribute('clip-path');
  midOutline.setAttribute('transform', `translate(${(mr.x - lr.x).toFixed(3)} ${(mr.y - lr.y).toFixed(3)})`);
  for (const [i, el] of order.entries()) {
    if (el === midRed) kept.push(midOutline.outerHTML.replace(/\s+xmlns="[^"]*"/, ''));
    const r = userBox(el);
    const m = el.getCTM(), rootM = root.getCTM();
    if (i < chiefIdx) continue; // drawn before the shield, so behind it
    const inside = r.x >= box.x0 && r.x + r.width <= box.x1 && r.y >= box.y0 && r.y + r.height <= box.y1;
    if (!inside) continue;
    if (el !== blue && r.y >= 423) continue; // motto scroll lettering below the book
    let html;
    if (el === img) {
      html = `<rect x="${chief.x.toFixed(3)}" y="${chief.y.toFixed(3)}" width="${chief.width.toFixed(3)}" height="${chief.height.toFixed(3)}" fill="#FFFFFF"/>`;
    } else {
      const c = el.cloneNode(false); c.removeAttribute('clip-path');
      // Bake any ancestor transform into the element.
      const t = el.parentNode.getCTM && el.parentNode !== root ? el.parentNode.transform?.baseVal?.consolidate() : null;
      if (t) { const m = t.matrix; c.setAttribute('transform', `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f}) ${c.getAttribute('transform') ?? ''}`.trim()); }
      html = c.outerHTML.replace(/\s+xmlns="[^"]*"/, '');
    }
    kept.push(html);
  }
  return { box, kept, outline: blue.getAttribute('d'), chief: [chief.x, chief.y, chief.width, chief.height] };
});
await b.close();
const { box, kept, chief } = res;
const w = box.x1 - box.x0, h = box.y1 - box.y0;
const clip = `<clipPath id="uvic-shield-clip"><rect x="${chief[0].toFixed(3)}" y="${chief[1].toFixed(3)}" width="${chief[2].toFixed(3)}" height="${(chief[3] + 2).toFixed(3)}"/><path d="${res.outline.replace(/\s+/g, ' ')}"/></clipPath>`;
const outSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.x0.toFixed(3)} ${box.y0.toFixed(3)} ${w.toFixed(3)} ${h.toFixed(3)}">` +
  `<defs>${clip}</defs><g clip-path="url(#uvic-shield-clip)"><rect x="${box.x0.toFixed(3)}" y="${box.y0.toFixed(3)}" width="${w.toFixed(3)}" height="${h.toFixed(3)}" fill="#000000"/>${kept.join('').replace(/\s+/g, ' ')}</g></svg>`;
writeFileSync(out, outSvg);
console.log(kept.length, 'elements', outSvg.length, 'bytes', box);
