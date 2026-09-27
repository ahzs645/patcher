// Region analysis on the colour-labelled raster: connected components,
// absorbing specks, distance fields and the patch silhouette outline.

import { TRANSPARENT } from './quantize';

/** Transparent pixels enclosed by the art (left unstitched, fabric shows). */
export const HOLE = 254;

export interface Comp {
  id: number;
  label: number;
  area: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  /** Largest distance (px) from any pixel to the region edge ≈ half the max width. */
  maxDist: number;
}

/** Mark transparent pixels that are not reachable from the image edge as HOLE. */
export function markHoles(labels: Uint8Array, w: number, h: number) {
  const outside = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (i: number) => {
    if (!outside[i] && labels[i] === TRANSPARENT) { outside[i] = 1; stack.push(i); }
  };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w, y = (i / w) | 0;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (y > 0) push(i - w);
    if (y < h - 1) push(i + w);
  }
  for (let i = 0; i < w * h; i++) if (labels[i] === TRANSPARENT && !outside[i]) labels[i] = HOLE;
}

/** 4-connected components of equal label (outside pixels get -1). */
export function components(labels: Uint8Array, w: number, h: number): { comp: Int32Array; comps: Comp[] } {
  const comp = new Int32Array(w * h).fill(-1);
  const comps: Comp[] = [];
  const stack: number[] = [];
  for (let start = 0; start < w * h; start++) {
    if (comp[start] !== -1 || labels[start] === TRANSPARENT) continue;
    const label = labels[start];
    const c: Comp = { id: comps.length, label, area: 0, minX: w, minY: h, maxX: 0, maxY: 0, maxDist: 0 };
    comps.push(c);
    comp[start] = c.id;
    stack.push(start);
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % w, y = (i / w) | 0;
      c.area++;
      if (x < c.minX) c.minX = x;
      if (x > c.maxX) c.maxX = x;
      if (y < c.minY) c.minY = y;
      if (y > c.maxY) c.maxY = y;
      if (x > 0 && comp[i - 1] === -1 && labels[i - 1] === label) { comp[i - 1] = c.id; stack.push(i - 1); }
      if (x < w - 1 && comp[i + 1] === -1 && labels[i + 1] === label) { comp[i + 1] = c.id; stack.push(i + 1); }
      if (y > 0 && comp[i - w] === -1 && labels[i - w] === label) { comp[i - w] = c.id; stack.push(i - w); }
      if (y < h - 1 && comp[i + w] === -1 && labels[i + w] === label) { comp[i + w] = c.id; stack.push(i + w); }
    }
  }
  return { comp, comps };
}

/**
 * Relabel components smaller than minArea with the label of the neighbour
 * they share the longest edge with. Isolated specks are dropped.
 * Returns true if anything changed.
 */
export function absorbSmall(labels: Uint8Array, comp: Int32Array, comps: Comp[], w: number, h: number, minArea: number): boolean {
  const small = new Set<number>();
  for (const c of comps) if (c.area < minArea) small.add(c.id);
  if (!small.size) return false;

  const votes = new Map<number, Map<number, number>>();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const ci = comp[i];
      if (ci < 0 || !small.has(ci)) continue;
      const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
      for (const j of nb) {
        if (j < 0) continue;
        const cj = comp[j];
        if (cj < 0 || cj === ci) continue;
        let m = votes.get(ci);
        if (!m) votes.set(ci, (m = new Map()));
        // Prefer absorbing into a large region over another speck.
        const weight = small.has(cj) ? 0.25 : 1;
        m.set(labels[j], (m.get(labels[j]) || 0) + weight);
      }
    }
  }

  const target = new Map<number, number>();
  for (const id of small) {
    const m = votes.get(id);
    let best = comps[id].label === HOLE ? HOLE : TRANSPARENT, bv = 0;
    if (m) for (const [l, v] of m) if (v > bv) { bv = v; best = l; }
    target.set(id, best);
  }
  for (let i = 0; i < w * h; i++) {
    const ci = comp[i];
    if (ci >= 0 && target.has(ci)) labels[i] = target.get(ci)!;
  }
  return true;
}

/**
 * Chamfer (3-4) distance, in px, from each pixel to the nearest pixel that is
 * not in the same component. Also fills Comp.maxDist.
 */
export function regionDistance(comp: Int32Array, comps: Comp[], w: number, h: number): Float32Array {
  const INF = 1e9;
  const d = new Float32Array(w * h).fill(INF);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const c = comp[i];
      if (c < 0) { d[i] = 0; continue; }
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1 ||
          comp[i - 1] !== c || comp[i + 1] !== c || comp[i - w] !== c || comp[i + w] !== c) d[i] = 0;
    }
  }
  const relax = (i: number, j: number, cost: number) => {
    if (comp[j] === comp[i] && d[j] + cost < d[i]) d[i] = d[j] + cost;
  };
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (comp[i] < 0 || d[i] === 0) continue;
      relax(i, i - 1, 3); relax(i, i - w, 3); relax(i, i - w - 1, 4); relax(i, i - w + 1, 4);
    }
  }
  for (let y = h - 2; y > 0; y--) {
    for (let x = w - 2; x > 0; x--) {
      const i = y * w + x;
      if (comp[i] < 0 || d[i] === 0) continue;
      relax(i, i + 1, 3); relax(i, i + w, 3); relax(i, i + w + 1, 4); relax(i, i + w - 1, 4);
    }
  }
  for (let i = 0; i < w * h; i++) {
    const c = comp[i];
    if (c < 0) continue;
    d[i] = d[i] / 3 + 0.5;
    if (d[i] > comps[c].maxDist) comps[c].maxDist = d[i];
  }
  return d;
}

/** Chamfer distance (px) from every silhouette pixel to the outside. */
export function silhouetteDistance(labels: Uint8Array, w: number, h: number): Float32Array {
  const INF = 1e9;
  const d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = labels[i] === TRANSPARENT ? 0 : INF;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!d[i]) continue;
      let v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + 3);
      if (y > 0) {
        v = Math.min(v, d[i - w] + 3);
        if (x > 0) v = Math.min(v, d[i - w - 1] + 4);
        if (x < w - 1) v = Math.min(v, d[i - w + 1] + 4);
      }
      d[i] = v;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (!d[i]) continue;
      let v = d[i];
      if (x < w - 1) v = Math.min(v, d[i + 1] + 3);
      if (y < h - 1) {
        v = Math.min(v, d[i + w] + 3);
        if (x < w - 1) v = Math.min(v, d[i + w + 1] + 4);
        if (x > 0) v = Math.min(v, d[i + w - 1] + 4);
      }
      d[i] = v;
    }
  }
  for (let i = 0; i < w * h; i++) if (d[i]) d[i] = d[i] / 3 - 0.5;
  return d;
}

/**
 * Outer outlines of the silhouette pieces (in px, pixel-corner coordinates),
 * largest first. Pieces smaller than minArea are ignored.
 */
export function traceOutlines(labels: Uint8Array, w: number, h: number, minArea: number): number[][] {
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && labels[y * w + x] !== TRANSPARENT;

  // 8-connected silhouette pieces.
  const piece = new Int32Array(w * h).fill(-1);
  const pieces: { start: number; area: number }[] = [];
  const stack: number[] = [];
  for (let s = 0; s < w * h; s++) {
    if (piece[s] !== -1 || labels[s] === TRANSPARENT) continue;
    const id = pieces.length;
    const p = { start: s, area: 0 };
    pieces.push(p);
    piece[s] = id;
    stack.push(s);
    while (stack.length) {
      const i = stack.pop()!;
      p.area++;
      const x = i % w, y = (i / w) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (!inside(nx, ny)) continue;
          const j = ny * w + nx;
          if (piece[j] === -1) { piece[j] = id; stack.push(j); }
        }
      }
    }
  }

  const out: number[][] = [];
  const sorted = pieces.filter((p) => p.area >= minArea).sort((a, b) => b.area - a.area);
  for (const p of sorted) {
    out.push(traceBoundary(inside, p.start % w, (p.start / w) | 0, w * h * 4));
  }
  return out;
}

/**
 * Walk the outer boundary of the shape containing (sx, sy), which must be the
 * first inside pixel in scan order (so outside is above and to the left).
 * Follows pixel cracks keeping the inside on the right; returns corner points.
 */
export function traceBoundary(inside: (x: number, y: number) => boolean, sx: number, sy: number, maxSteps: number): number[] {
  const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
  let cx = sx, cy = sy, dir = 0;
  const pts: number[] = [];
  let guard = 0;
  do {
    pts.push(cx, cy);
    // Pixels ahead-left / ahead-right of the corner for the current heading.
    let al: boolean, ar: boolean;
    if (dir === 0) { al = inside(cx, cy - 1); ar = inside(cx, cy); }
    else if (dir === 1) { al = inside(cx, cy); ar = inside(cx - 1, cy); }
    else if (dir === 2) { al = inside(cx - 1, cy); ar = inside(cx - 1, cy - 1); }
    else { al = inside(cx - 1, cy - 1); ar = inside(cx, cy - 1); }
    if (al) dir = (dir + 3) % 4;
    else if (!ar) dir = (dir + 1) % 4;
    cx += DX[dir];
    cy += DY[dir];
  } while ((cx !== sx || cy !== sy) && ++guard < maxSteps);
  return pts;
}

/** Douglas–Peucker simplification of a closed polygon given as flat [x,y,...]. */
export function simplifyClosed(pts: number[], eps: number): number[] {
  const n = pts.length / 2;
  if (n < 4) return pts.slice();
  const keep = new Uint8Array(n);
  // Split at the vertex farthest from vertex 0 so both halves are open chains.
  let far = 0, fd = -1;
  for (let i = 1; i < n; i++) {
    const d = (pts[i * 2] - pts[0]) ** 2 + (pts[i * 2 + 1] - pts[1]) ** 2;
    if (d > fd) { fd = d; far = i; }
  }
  keep[0] = keep[far] = 1;
  const rec = (a: number, b: number) => {
    const ax = pts[a * 2], ay = pts[a * 2 + 1];
    const bx = pts[(b % n) * 2], by = pts[(b % n) * 2 + 1];
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    let best = -1, bd = eps;
    for (let i = a + 1; i < b; i++) {
      const k = i % n;
      const d = Math.abs((pts[k * 2] - ax) * dy - (pts[k * 2 + 1] - ay) * dx) / len;
      if (d > bd) { bd = d; best = i; }
    }
    if (best >= 0) { keep[best % n] = 1; rec(a, best); rec(best, b); }
  };
  rec(0, far);
  rec(far, n);
  const out: number[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i * 2], pts[i * 2 + 1]);
  return out;
}

/** Chaikin corner cutting on a closed polygon. */
export function chaikinClosed(pts: number[], iterations: number): number[] {
  let cur = pts;
  for (let it = 0; it < iterations; it++) {
    const n = cur.length / 2;
    const next: number[] = [];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const x0 = cur[i * 2], y0 = cur[i * 2 + 1], x1 = cur[j * 2], y1 = cur[j * 2 + 1];
      next.push(0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1, 0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1);
    }
    cur = next;
  }
  return cur;
}

/** Resample a closed polygon at a fixed arc-length spacing. */
export function resampleClosed(pts: number[], spacing: number): number[] {
  const n = pts.length / 2;
  let total = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    total += Math.hypot(pts[j * 2] - pts[i * 2], pts[j * 2 + 1] - pts[i * 2 + 1]);
  }
  const count = Math.max(8, Math.round(total / spacing));
  const step = total / count;
  const out: number[] = [];
  let seg = 0, segStart = 0;
  let segLen = Math.hypot(pts[2] - pts[0], pts[3] - pts[1]);
  for (let k = 0; k < count; k++) {
    const target = k * step;
    while (segStart + segLen < target && seg < n - 1) {
      segStart += segLen;
      seg++;
      const j = (seg + 1) % n;
      segLen = Math.hypot(pts[j * 2] - pts[seg * 2], pts[j * 2 + 1] - pts[seg * 2 + 1]);
    }
    const j = (seg + 1) % n;
    const t = segLen > 0 ? (target - segStart) / segLen : 0;
    out.push(pts[seg * 2] + (pts[j * 2] - pts[seg * 2]) * t, pts[seg * 2 + 1] + (pts[j * 2 + 1] - pts[seg * 2 + 1]) * t);
  }
  return out;
}
