// Digitizing pipeline: rendered SVG pixels -> thread colours -> regions ->
// tatami / satin / border stitches (+ a relief map for the textured render).

import type { DigitizeParams, DigitizeResult, RasterInput, StitchBlock, StitchKind } from '../types';
import { quantize, toHex, TRANSPARENT } from './quantize';
import {
  HOLE, absorbSmall, chaikinClosed, components, markHoles, regionDistance, resampleClosed,
  silhouetteDistance, simplifyClosed, traceBoundary, traceOutlines, type Comp,
} from './regions';
import { border, contourSatin, frame, meanRunLength, satin, scanRows, tatami } from './stitches';

/** Fill angle offsets per colour rank so adjacent colours catch light differently. */
const ANGLE_OFFSETS = [0, 90, -35, 55, 25, -65, 70, -15];

export function digitize(raster: RasterInput, params: DigitizeParams): DigitizeResult {
  const timings: Record<string, number> = {};
  let t0 = performance.now();
  const lap = (name: string) => { const t = performance.now(); timings[name] = Math.round(t - t0); t0 = t; };

  const { width: w, height: h, data, padPx } = raster;
  const ppm = params.pxPerMm;

  const { palette: rgb, labels } = quantize(data, w, h, params.maxColors, params.colorTolerance);
  const palette = rgb.map(toHex);
  lap('quantize');

  markHoles(labels, w, h);
  const minArea = Math.max(4, params.minRegionMm2 * ppm * ppm);
  let comp: Int32Array, comps: Comp[];
  for (let pass = 0; ; pass++) {
    ({ comp, comps } = components(labels, w, h));
    if (pass >= 3 || !absorbSmall(labels, comp, comps, w, h, minArea)) break;
  }
  const dist = regionDistance(comp, comps, w, h);
  const silDist = silhouetteDistance(labels, w, h);
  lap('regions');

  const coverage = new Array(palette.length).fill(0);
  let opaque = 0;
  for (const c of comps) if (c.label !== HOLE) { coverage[c.label] += c.area; opaque += c.area; }
  for (let i = 0; i < coverage.length; i++) coverage[i] = opaque ? coverage[i] / opaque : 0;

  // ---- regions -> stitch blocks --------------------------------------------
  const satinMaxPx = params.satinMaxWidthMm * ppm;
  const regions = comps.filter((c) => c.label !== HOLE);
  const isSatin = (c: Comp) => c.maxDist * 2 <= satinMaxPx;
  const colorRank = palette.map((_, i) => i).sort((a, b) => coverage[b] - coverage[a]);
  const rankOf = new Map(colorRank.map((l, r) => [l, r]));

  const blocks: StitchBlock[] = [];
  let needle: [number, number] = [padPx, padPx];
  const toMm = (pts: number[]) => {
    const out = new Float32Array(pts.length);
    for (let i = 0; i < pts.length; i++) out[i] = pts[i] / ppm;
    return out;
  };
  // Drop needle points closer than this to the previous one (bastidor
  // minspacing / inkstitch collapse): tiny stitches just perforate the fabric.
  const minStitch = 0.2 * ppm;
  const pushBlock = (color: string, paletteIndex: number, kind: StitchKind, raw: number[], rawJumps: number[]) => {
    const jumpSet = new Set(rawJumps);
    const pts: number[] = [];
    const jumps: number[] = [];
    for (let i = 0; i < raw.length / 2; i++) {
      const x = raw[i * 2], y = raw[i * 2 + 1];
      const isJump = jumpSet.has(i);
      if (!isJump && pts.length) {
        const lx = pts[pts.length - 2], ly = pts[pts.length - 1];
        const lastIsLast = i === raw.length / 2 - 1;
        if (Math.hypot(x - lx, y - ly) < minStitch && !lastIsLast) continue;
      }
      if (isJump) jumps.push(pts.length / 2);
      pts.push(x, y);
    }
    if (pts.length < 4) return;
    blocks.push({ color, paletteIndex, kind, points: toMm(pts), jumps: Uint32Array.from(jumps) });
    needle = [pts[pts.length - 2], pts[pts.length - 1]];
  };

  // One thread stop per colour, biggest colour first: its fills, then its
  // satin details. Regions come from a raster partition, so they don't
  // overlap and a separate "satin on top" pass would only add colour changes.
  for (const label of colorRank) {
    for (const pass of ['fill', 'satin'] as const) {
      const todo = regions.filter((c) => c.label === label && (pass === 'satin') === isSatin(c));
      while (todo.length) {
        // Nearest region next, to keep travel short.
        let bi = 0, bd = Infinity;
        for (let i = 0; i < todo.length; i++) {
          const c = todo[i];
          const cx = (c.minX + c.maxX) / 2, cy = (c.minY + c.maxY) / 2;
          const d = (cx - needle[0]) ** 2 + (cy - needle[1]) ** 2;
          if (d < bd) { bd = d; bi = i; }
        }
        const c = todo.splice(bi, 1)[0];
        const travel = {
          inside: (x: number, y: number) => {
            const xi = Math.floor(x), yi = Math.floor(y);
            return xi >= 0 && yi >= 0 && xi < w && yi < h && comp[yi * w + xi] === c.id;
          },
          step: 2.5 * ppm,
          maxLen: 15 * ppm,
        };
        if (pass === 'fill') {
          const deg = params.fillAngleDeg + (params.varyAngles ? ANGLE_OFFSETS[rankOf.get(label)! % ANGLE_OFFSETS.length] : 0);
          const f = frame((deg * Math.PI) / 180);
          if (params.underlay) {
            // inkstitch-style fill underlay: fill angle + 90°, sparse rows,
            // inset from the edge so it never pokes out past the top stitches.
            const inset = 0.4 * ppm;
            const uf = frame(((deg + 90) * Math.PI) / 180);
            const urows = scanRows(comp, w, h, c, uf, 1.5 * ppm, 0, (i) => dist[i] >= inset);
            const u = tatami(urows, uf, 4 * ppm, 0.8 * ppm, needle, 3 * ppm, travel);
            pushBlock(palette[label], label, 'underlay', u.pts, u.jumps);
          }
          const rows = scanRows(comp, w, h, c, f, params.fillSpacingMm * ppm, params.pullCompMm * ppm);
          const p = tatami(rows, f, params.fillStitchMm * ppm, 0.6 * ppm, needle, 3 * ppm, travel);
          pushBlock(palette[label], label, 'fill', p.pts, p.jumps);
        } else {
          // Preferred: rungs that follow the stroke around curves.
          let sx = c.minX;
          while (sx <= c.maxX && comp[c.minY * w + sx] !== c.id) sx++;
          const insideC = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && comp[y * w + x] === c.id;
          const rawEdge = traceBoundary(insideC, sx, c.minY, c.area * 8 + 64);
          const edge = resampleClosed(chaikinClosed(simplifyClosed(rawEdge, 0.5), 1), params.satinSpacingMm * ppm);
          const cs = contourSatin(comp, dist, w, h, c, c.area, edge, params.satinSpacingMm * ppm, satinMaxPx,
            (params.pullCompMm + 0.05) * ppm, params.satinMaxStitchMm * ppm, needle, 1.2 * ppm);
          if (cs) {
            pushBlock(palette[label], label, 'satin', cs.pts, cs.jumps);
            continue;
          }
          // Fallback: fixed angle across the stroke (shortest runs).
          let bestAng = 0, bestLen = Infinity;
          for (let k = 0; k < 12; k++) {
            const a = (k * Math.PI) / 12;
            const len = meanRunLength(scanRows(comp, w, h, c, frame(a), Math.max(1.5, ppm * 0.5), 0));
            if (len < bestLen) { bestLen = len; bestAng = a; }
          }
          const f = frame(bestAng);
          const rows = scanRows(comp, w, h, c, f, params.satinSpacingMm * ppm, (params.pullCompMm + 0.05) * ppm);
          const p = satin(rows, f, params.satinMaxStitchMm * ppm, needle, 2 * ppm, travel);
          pushBlock(palette[label], label, 'satin', p.pts, p.jumps);
        }
      }
    }
  }
  lap('stitches');

  // ---- outline + border -----------------------------------------------------
  const outlinesPx = traceOutlines(labels, w, h, minArea * 20).map((o) => chaikinClosed(simplifyClosed(o, 0.7), 2));
  let borderColor: string | null = null;
  if (params.border !== 'none' && outlinesPx.length) {
    const inner = params.borderWidthMm * ppm * (params.border === 'merrow' ? 0.8 : 1);
    const outer = params.border === 'merrow' ? params.borderWidthMm * ppm * 0.25 : 0.1 * ppm;
    const spacing = (params.border === 'merrow' ? 0.5 : 0.4) * ppm;
    const labelAt = (x: number, y: number) => {
      const xi = Math.floor(x), yi = Math.floor(y);
      return xi >= 0 && yi >= 0 && xi < w && yi < h ? labels[yi * w + xi] : TRANSPARENT;
    };

    const rails: { pts: number[] }[] = [];
    const votes = new Map<number, number>();
    for (const o of outlinesPx) {
      const res = resampleClosed(o, spacing);
      // Which normal direction points out of the patch?
      let out = 0;
      const n = res.length / 2;
      for (let k = 0; k < n; k += Math.max(1, Math.floor(n / 40))) {
        const a = (k + n - 2) % n, b = (k + 2) % n;
        const tx = res[b * 2] - res[a * 2], ty = res[b * 2 + 1] - res[a * 2 + 1];
        const l = Math.hypot(tx, ty) || 1;
        const px = res[k * 2] + (-ty / l) * 2, py = res[k * 2 + 1] + (tx / l) * 2;
        out += labelAt(px, py) === TRANSPARENT ? 1 : -1;
      }
      const outward = out >= 0 ? 1 : -1;
      const pts = border(res, outward, inner, outer);
      // Vote on the art colour just inside the edge.
      for (let i = 0; i < pts.length; i += 8) {
        const ix = pts[i], iy = pts[i + 1], ox = pts[i + 2], oy = pts[i + 3];
        const u = (outer + 0.8 * ppm) / (inner + outer);
        const l = labelAt(ox + (ix - ox) * u, oy + (iy - oy) * u);
        if (l < palette.length) votes.set(l, (votes.get(l) || 0) + 1);
      }
      rails.push({ pts });
    }
    let autoLabel = -1, bv = 0;
    for (const [l, v] of votes) if (v > bv) { bv = v; autoLabel = l; }
    borderColor = params.borderColor ?? (autoLabel >= 0 ? palette[autoLabel] : '#222222');
    const pIndex = params.borderColor ? palette.indexOf(params.borderColor) : autoLabel;
    for (const r of rails) pushBlock(borderColor, pIndex, 'border', r.pts, [0]);
  }
  lap('border');

  // ---- relief height map ---------------------------------------------------
  const height = new Float32Array(w * h);
  const fillRamp = 1.1 * ppm;
  const bandIn = params.border === 'none' ? 0 : params.borderWidthMm * ppm * (params.border === 'merrow' ? 0.8 : 1);
  for (let i = 0; i < w * h; i++) {
    const ci = comp[i];
    if (ci < 0) continue;
    const c = comps[ci];
    if (c.label === HOLE) continue;
    const d = dist[i];
    let v: number;
    if (isSatin(c)) {
      const u = Math.min(1, d / Math.max(1, c.maxDist));
      v = 0.35 + 0.55 * Math.sqrt(1 - (1 - u) * (1 - u));
    } else {
      const u = Math.min(1, d / fillRamp);
      v = 0.15 + 0.3 * u * u * (3 - 2 * u);
    }
    if (bandIn > 0) {
      const sd = silDist[i];
      if (sd < bandIn + 0.5 * ppm) {
        const u = Math.min(1, sd / bandIn);
        const dome = 0.5 + 0.5 * Math.sqrt(Math.max(0, 1 - (2 * u - 1) ** 2));
        v = sd < bandIn ? Math.max(v, dome) : v * 0.85; // groove just inside the border
      }
    }
    height[i] = v;
  }
  lap('relief');

  let stitchCount = 0;
  for (const b of blocks) stitchCount += b.points.length / 2;

  return {
    widthMm: w / ppm,
    heightMm: h / ppm,
    padMm: padPx / ppm,
    pxPerMm: ppm,
    palette,
    coverage,
    blocks,
    outlines: outlinesPx.map(toMm),
    height,
    rasterW: w,
    rasterH: h,
    stitchCount,
    borderColor,
    timings,
  };
}
