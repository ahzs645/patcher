// SVG loading: sanitising, sizing and rasterising via the browser's own SVG
// renderer. Rasterising (instead of parsing geometry ourselves like
// bastidor/inkstitch do) means text, gradients, clip paths, <use>, CSS
// classes and every other SVG feature found in real-world patch art just work.

import type { RasterInput } from './types';

export interface LoadedSvg {
  /** Sanitised markup, safe to display. */
  text: string;
  /** Intrinsic aspect ratio (height / width). */
  aspect: number;
  url: string;
}

const UNIT_TO_PX: Record<string, number> = {
  '': 1, px: 1, pt: 4 / 3, pc: 16, mm: 96 / 25.4, cm: 96 / 2.54, in: 96,
};

function parseLength(v: string | null): number | null {
  if (!v) return null;
  const m = /^\s*([0-9.eE+-]+)\s*([a-z%]*)\s*$/.exec(v);
  if (!m || m[2] === '%') return null;
  const n = parseFloat(m[1]);
  const k = UNIT_TO_PX[m[2]];
  return Number.isFinite(n) && n > 0 && k ? n * k : null;
}

export function loadSvg(raw: string): LoadedSvg {
  const doc = new DOMParser().parseFromString(raw, 'image/svg+xml');
  const root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) {
    throw new Error('Not a valid SVG file.');
  }

  // Strip anything active. The SVG is only ever shown through <img>, which
  // never runs scripts anyway, but keep the stored copy clean too.
  doc.querySelectorAll('script, foreignObject').forEach((n) => n.remove());
  doc.querySelectorAll('*').forEach((el) => {
    for (const a of Array.from(el.attributes)) {
      if (/^on/i.test(a.name)) el.removeAttribute(a.name);
    }
  });

  let w = parseLength(root.getAttribute('width'));
  let h = parseLength(root.getAttribute('height'));
  const vb = (root.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
  const hasVb = vb.length === 4 && vb.every(Number.isFinite) && vb[2] > 0 && vb[3] > 0;
  if (hasVb && (!w || !h)) {
    if (w && !h) h = (w * vb[3]) / vb[2];
    else if (h && !w) w = (h * vb[2]) / vb[3];
    else { w = vb[2]; h = vb[3]; }
  }
  if (!w || !h) { w = 300; h = 300; }
  if (!hasVb) root.setAttribute('viewBox', `0 0 ${w} ${h}`);
  if (!root.getAttribute('xmlns')) root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  // Size is set at raster time; the display copy scales to its container.
  root.setAttribute('width', String(w));
  root.setAttribute('height', String(h));
  root.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  const text = new XMLSerializer().serializeToString(doc);
  const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
  return { text, aspect: h / w, url };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('The browser could not render this SVG.'));
    img.src = url;
  });
}

/** What counts as lettering: SVG text, and outlined lettering tagged by its exporter (forestoval keeps data-live-text). */
const LETTERING = 'text, [data-live-text]';

/**
 * The same SVG with everything but the lettering hidden, or null when it has
 * none. visibility is inherited and can be turned back on by a descendant,
 * so one rule hides the art and the next shows the lettering through it,
 * including lettering drawn by <use> into a hidden parent.
 */
function letteringOnly(text: string): string | null {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const root = doc.documentElement;
  if (!root.querySelector(LETTERING)) return null;
  const style = doc.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = `*{visibility:hidden!important}${LETTERING.split(', ').map((s) => `${s},${s} *`).join(',')}{visibility:visible!important}`;
  root.append(style);
  return new XMLSerializer().serializeToString(doc);
}

async function drawSvg(text: string, artW: number, artH: number, padPx: number): Promise<ImageData> {
  // Re-emit the SVG at the exact pixel size so the browser renders it crisply
  // instead of scaling a small bitmap.
  const sized = text.replace(
    /<svg\b([^>]*)>/,
    (_m, attrs: string) =>
      `<svg${attrs.replace(/\s(width|height)="[^"]*"/g, '')} width="${artW}" height="${artH}">`,
  );
  const url = URL.createObjectURL(new Blob([sized], { type: 'image/svg+xml' }));
  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = artW + padPx * 2;
    canvas.height = artH + padPx * 2;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, padPx, padPx, artW, artH);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Render the SVG at the digitizing resolution, with transparent padding around it. */
export async function rasterize(svg: LoadedSvg, widthMm: number, pxPerMm: number, padMm: number): Promise<RasterInput> {
  const artW = Math.max(16, Math.round(widthMm * pxPerMm));
  const artH = Math.max(16, Math.round(artW * svg.aspect));
  const padPx = Math.round(padMm * pxPerMm);
  const id = await drawSvg(svg.text, artW, artH, padPx);
  const raster: RasterInput = { width: id.width, height: id.height, data: id.data, padPx };
  const lettering = letteringOnly(svg.text);
  if (lettering) {
    const m = await drawSvg(lettering, artW, artH, padPx);
    const mask = new Uint8Array(m.width * m.height);
    for (let i = 0; i < mask.length; i++) mask[i] = m.data[i * 4 + 3] >= 128 ? 1 : 0;
    raster.textMask = mask;
  }
  return raster;
}
