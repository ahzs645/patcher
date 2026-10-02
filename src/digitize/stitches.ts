// Stitch generation on raster regions.
//
// Tatami fill follows the classic scanline approach used by inkstitch
// (auto_fill) and bastidor (fill.js/sections.js): parallel rows at an angle,
// split into runs inside the shape, grouped into boustrophedon sections, with
// needle points staggered row to row so no visible lines form. Narrow regions
// (lettering, rules, pinstripes) are sewn as satin: the same rows, but each
// row is a single stitch from edge to edge, oriented across the stroke.

export interface Row {
  /** Offset along the row normal (px). */
  t: number;
  /** Canvas-anchored row number (t / spacing), so staggers line up across regions. */
  k: number;
  /** Flat [s0, s1, s0, s1, ...] intervals along the row direction (px). */
  segs: number[];
}

export interface Frame {
  dx: number;
  dy: number;
  nx: number;
  ny: number;
}

export function frame(angleRad: number): Frame {
  const dx = Math.cos(angleRad), dy = Math.sin(angleRad);
  return { dx, dy, nx: -dy, ny: dx };
}

export interface CompBox {
  id: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Scan a component with parallel rows. Coordinates are px (pixel centres at +0.5). */
export function scanRows(
  comp: Int32Array, w: number, h: number, box: CompBox, f: Frame, spacing: number, extend: number,
  /** Optional extra per-pixel test (e.g. an inset for underlay). */
  accept?: (i: number) => boolean,
): Row[] {
  const xs = [box.minX, box.maxX + 1], ys = [box.minY, box.maxY + 1];
  let smin = Infinity, smax = -Infinity, tmin = Infinity, tmax = -Infinity;
  for (const x of xs) for (const y of ys) {
    const s = x * f.dx + y * f.dy, t = x * f.nx + y * f.ny;
    if (s < smin) smin = s;
    if (s > smax) smax = s;
    if (t < tmin) tmin = t;
    if (t > tmax) tmax = t;
  }
  const STEP = 0.5;
  const rows: Row[] = [];
  // Rows sit on a grid anchored to the canvas (inkstitch fill.py), not to
  // the region, so neighbouring regions and sections share row positions.
  const k0 = Math.ceil(tmin / spacing - 0.5), k1 = Math.floor(tmax / spacing - 0.5);
  for (let k = k0; k <= k1; k++) {
    const t = (k + 0.5) * spacing;
    const segs: number[] = [];
    let open = NaN;
    for (let s = smin; s <= smax + STEP; s += STEP) {
      const x = Math.floor(t * f.nx + s * f.dx), y = Math.floor(t * f.ny + s * f.dy);
      const inside = x >= 0 && y >= 0 && x < w && y < h && comp[y * w + x] === box.id && (!accept || accept(y * w + x));
      if (inside && Number.isNaN(open)) open = s;
      else if (!inside && !Number.isNaN(open)) {
        if (s - open >= 1) segs.push(open - extend, s + extend);
        open = NaN;
      }
    }
    rows.push({ t, k, segs });
  }
  return rows;
}

/** Average run length for an angle: small means the rows cut across the shape. */
export function meanRunLength(rows: Row[]): number {
  let total = 0, n = 0;
  for (const r of rows) for (let i = 0; i < r.segs.length; i += 2) { total += r.segs[i + 1] - r.segs[i]; n++; }
  return n ? total / n : Infinity;
}

export interface PathOut {
  /** Flat [x,y,...] in px. */
  pts: number[];
  jumps: number[];
}

/**
 * Walk the runs in boustrophedon sections and hand every run, in travel
 * order, to `emit`. `emit` receives (row index, from s, to s, t).
 */
export interface Travel {
  /** Point-in-region test (px). */
  inside: (x: number, y: number) => boolean;
  /** Running-stitch length for travel (px). */
  step: number;
  /** Longest travel before we give up and trim instead (px). */
  maxLen: number;
}

/**
 * Walk the runs in boustrophedon sections and hand every run, in travel
 * order, to `emit` (row index, from s, to s, t, jump).
 *
 * Between sections the needle travels with a running stitch instead of a
 * jump+trim when it can do so hidden: bastidor's policy (straight line that
 * stays inside the region, capped length) combined with inkstitch's rule
 * that travel may only run under rows that haven't been sewn yet — they
 * will cover it.
 */
function walkSections(
  rows: Row[], f: Frame, start: [number, number], maxConnector: number,
  emit: (row: number, sFrom: number, sTo: number, t: number, jump: boolean) => [number, number],
  travel?: Travel, onTravel?: (from: [number, number], to: [number, number]) => void,
) {
  const visited = rows.map((r) => new Uint8Array(r.segs.length / 2));
  let remaining = 0;
  for (const r of rows) remaining += r.segs.length / 2;
  let pos = start;

  const endPoint = (ri: number, si: number, which: 0 | 1): [number, number] => {
    const s = rows[ri].segs[si * 2 + which], t = rows[ri].t;
    return [t * f.nx + s * f.dx, t * f.ny + s * f.dy];
  };

  const spacing = rows.length > 1 ? rows[1].t - rows[0].t : 1;
  const canTravel = (from: [number, number], to: [number, number]) => {
    if (!travel) return false;
    const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
    if (len > travel.maxLen) return false;
    const steps = Math.ceil(len / 0.5);
    for (let k = 1; k < steps; k++) {
      const x = from[0] + ((to[0] - from[0]) * k) / steps, y = from[1] + ((to[1] - from[1]) * k) / steps;
      if (!travel.inside(x, y)) return false;
      const ri = Math.round((x * f.nx + y * f.ny - rows[0].t) / spacing);
      if (ri < 0 || ri >= rows.length) continue;
      const sv = x * f.dx + y * f.dy, segs = rows[ri].segs;
      for (let j = 0; j < segs.length / 2; j++) {
        if (visited[ri][j] && sv >= segs[j * 2] - 0.5 && sv <= segs[j * 2 + 1] + 0.5) return false;
      }
    }
    return true;
  };
  const nearEnd = (c: { ri: number; si: number }): [number, number] => {
    const p0 = endPoint(c.ri, c.si, 0), p1 = endPoint(c.ri, c.si, 1);
    return (p0[0] - pos[0]) ** 2 + (p0[1] - pos[1]) ** 2 <= (p1[0] - pos[0]) ** 2 + (p1[1] - pos[1]) ** 2 ? p0 : p1;
  };
  const tryTravel = (c: { ri: number; si: number }) => {
    const to = nearEnd(c);
    if (canTravel(pos, to)) { onTravel?.(pos, to); return true; }
    return false;
  };

  let cur: { ri: number; si: number } | null = null;
  let jump = true;
  let firstRun = true;
  while (remaining > 0) {
    if (!cur) {
      let best = Infinity;
      for (let ri = 0; ri < rows.length; ri++) {
        for (let si = 0; si < visited[ri].length; si++) {
          if (visited[ri][si]) continue;
          for (const which of [0, 1] as const) {
            const p = endPoint(ri, si, which);
            const d = (p[0] - pos[0]) ** 2 + (p[1] - pos[1]) ** 2;
            if (d < best) { best = d; cur = { ri, si }; }
          }
        }
      }
      jump = firstRun || !tryTravel(cur!);
    }
    firstRun = false;
    const ri: number = cur!.ri, si: number = cur!.si;
    visited[ri][si] = 1;
    remaining--;
    const a = rows[ri].segs[si * 2], b = rows[ri].segs[si * 2 + 1];
    const pa = endPoint(ri, si, 0), pb = endPoint(ri, si, 1);
    const fromA = (pa[0] - pos[0]) ** 2 + (pa[1] - pos[1]) ** 2 <= (pb[0] - pos[0]) ** 2 + (pb[1] - pos[1]) ** 2;
    pos = fromA ? emit(ri, a, b, rows[ri].t, jump) : emit(ri, b, a, rows[ri].t, jump);
    jump = false;

    // Continue into the overlapping run of the next row (then previous row).
    cur = null;
    for (const nr of [ri + 1, ri - 1] as number[]) {
      if (nr < 0 || nr >= rows.length) continue;
      let bestOv = 0;
      const segs = rows[nr].segs;
      for (let sj = 0; sj < segs.length / 2; sj++) {
        if (visited[nr][sj]) continue;
        const ov = Math.min(b, segs[sj * 2 + 1]) - Math.max(a, segs[sj * 2]);
        if (ov > bestOv) { bestOv = ov; cur = { ri: nr, si: sj }; }
      }
      if (cur) break;
    }
    if (cur) {
      // A long connector would show as a stray diagonal: treat it as a jump.
      const q0 = endPoint(cur.ri, cur.si, 0), q1 = endPoint(cur.ri, cur.si, 1);
      const d = Math.min(Math.hypot(q0[0] - pos[0], q0[1] - pos[1]), Math.hypot(q1[0] - pos[0], q1[1] - pos[1]));
      if (d > maxConnector) jump = !tryTravel(cur);
    }
  }
}

const STAGGER = [0, 0.5, 0.25, 0.75];

export function tatami(
  rows: Row[], f: Frame, stitchLen: number, minLen: number, start: [number, number], connectorMax: number,
  travel?: Travel,
): PathOut {
  const pts: number[] = [];
  const jumps: number[] = [];
  walkSections(rows, f, start, connectorMax, (ri, sFrom, sTo, t, jump) => {
    const put = (s: number) => pts.push(t * f.nx + s * f.dx, t * f.ny + s * f.dy);
    if (jump) jumps.push(pts.length / 2);
    put(sFrom);
    const off = STAGGER[((rows[ri].k % STAGGER.length) + STAGGER.length) % STAGGER.length] * stitchLen;
    const lo = Math.min(sFrom, sTo), hi = Math.max(sFrom, sTo);
    const grid: number[] = [];
    let k = Math.ceil((lo + minLen - off) / stitchLen);
    for (let s = off + k * stitchLen; s < hi - minLen; s = off + ++k * stitchLen) grid.push(s);
    if (sFrom > sTo) grid.reverse();
    for (const s of grid) put(s);
    put(sTo);
    return [t * f.nx + sTo * f.dx, t * f.ny + sTo * f.dy];
  }, travel, (from, to) => {
    const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const n = Math.ceil(len / travel!.step);
    for (let k = 1; k < n; k++) pts.push(from[0] + ((to[0] - from[0]) * k) / n, from[1] + ((to[1] - from[1]) * k) / n);
  });
  return { pts, jumps };
}

export function satin(
  rows: Row[], f: Frame, maxStitch: number, start: [number, number], connectorMax: number,
  travel?: Travel,
): PathOut {
  const pts: number[] = [];
  const jumps: number[] = [];
  walkSections(rows, f, start, connectorMax, (ri, sFrom, sTo, t, jump) => {
    const put = (s: number) => pts.push(t * f.nx + s * f.dx, t * f.ny + s * f.dy);
    if (jump) jumps.push(pts.length / 2);
    put(sFrom);
    const len = Math.abs(sTo - sFrom);
    if (len > maxStitch) {
      // Split long satin columns, alternating the split point so it doesn't line up.
      const parts = Math.ceil(len / maxStitch);
      const shift = (rows[ri].k & 1 ? 0.3 : -0.3) / parts;
      for (let p = 1; p < parts; p++) put(sFrom + (sTo - sFrom) * (p / parts + shift));
    }
    put(sTo);
    return [t * f.nx + sTo * f.dx, t * f.ny + sTo * f.dy];
  }, travel, (from, to) => {
    const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const n = Math.ceil(len / travel!.step);
    for (let k = 1; k < n; k++) pts.push(from[0] + ((to[0] - from[0]) * k) / n, from[1] + ((to[1] - from[1]) * k) / n);
  });
  return { pts, jumps };
}

/**
 * Edge border along a closed outline (px). `outward` is +1/-1 so that
 * p + outward * n points away from the patch. The needle zig-zags between
 * an inner and an outer rail; for a merrow edge the outer rail sits past the
 * cut edge, as the overlock thread wraps around it.
 */
export function border(outline: number[], outward: number, inner: number, outer: number): number[] {
  const n = outline.length / 2;
  const pts: number[] = [];
  const K = 3;
  for (let i = 0; i <= n; i++) {
    const k = i % n;
    const a = ((k - K) % n + n) % n, b = (k + K) % n;
    let tx = outline[b * 2] - outline[a * 2], ty = outline[b * 2 + 1] - outline[a * 2 + 1];
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl; ty /= tl;
    const nx = -ty * outward, ny = tx * outward;
    const x = outline[k * 2], y = outline[k * 2 + 1];
    pts.push(x - nx * inner, y - ny * inner, x + nx * outer, y + ny * outer);
  }
  return pts;
}

/**
 * Satin that follows the stroke. Rungs are cast from the region's edge along
 * the inward edge normal until they exit the far side (PEmbroider's
 * strokePolyNormal / hatchSpine idea), so stitches stay perpendicular to the
 * stroke around curves — an "O" or "S" is sewn the way a digitizer would.
 * An occupancy mask (PEmbroider's vector-field hatch) drops rungs that would
 * pile up on the inside of curves or duplicate rungs cast from the other edge.
 * Returns null when the rungs can't cover the region (blobs, junctions) so the
 * caller can fall back to fixed-angle satin.
 */
export function contourSatin(
  comp: Int32Array, dist: Float32Array, w: number, h: number, box: CompBox, area: number,
  edge: number[], spacing: number, maxWidth: number, extend: number, maxStitch: number,
  start: [number, number], connectorMax: number,
): PathOut | null {
  const inside = (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    return xi >= 0 && yi >= 0 && xi < w && yi < h && comp[yi * w + xi] === box.id;
  };
  const n = edge.length / 2;
  if (n < 6) return null;
  const occ = new Uint8Array(w * h);
  const isOcc = (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    return xi >= 0 && yi >= 0 && xi < w && yi < h && occ[yi * w + xi] === 1;
  };
  const rungs: number[] = [];
  const r = spacing * 0.55;

  for (let i = 0; i < n; i++) {
    const a = (i + n - 2) % n, b = (i + 2) % n;
    let tx = edge[b * 2] - edge[a * 2], ty = edge[b * 2 + 1] - edge[a * 2 + 1];
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl; ty /= tl;
    const px = edge[i * 2], py = edge[i * 2 + 1];
    let nx = -ty, ny = tx;
    if (!inside(px + nx * 0.8, py + ny * 0.8)) {
      nx = -nx; ny = -ny;
      if (!inside(px + nx * 0.8, py + ny * 0.8)) continue;
    }
    let L = 0.3;
    while (L < maxWidth * 2 && inside(px + nx * (L + 0.5), py + ny * (L + 0.5))) L += 0.5;
    L += 0.25;
    if (L < 1 || L > maxWidth * 1.7) continue;
    // A rung that truly crosses the stroke passes through its centreline, so
    // its midpoint is ~L/2 from the edge. Rungs cast from a stroke end or a
    // corner run along the stroke instead and fail this test.
    const mx = Math.floor(px + nx * L * 0.5), my = Math.floor(py + ny * L * 0.5);
    if (dist[my * w + mx] < L * 0.36) continue;
    // Skip if this rung's path is already sewn.
    let hits = 0;
    for (const f of [0.25, 0.5, 0.75]) if (isOcc(px + nx * L * f, py + ny * L * f)) hits++;
    if (hits >= 3) continue;
    for (let d = 0; d <= L; d += 0.5) {
      for (let o = -r; o <= r; o += 0.5) {
        const x = Math.floor(px + nx * d + tx * o), y = Math.floor(py + ny * d + ty * o);
        if (x >= 0 && y >= 0 && x < w && y < h && comp[y * w + x] === box.id) occ[y * w + x] = 1;
      }
    }
    rungs.push(px - nx * extend, py - ny * extend, px + nx * (L + extend), py + ny * (L + extend));
  }

  let covered = 0;
  for (let y = box.minY; y <= box.maxY; y++) for (let x = box.minX; x <= box.maxX; x++) if (occ[y * w + x]) covered++;
  if (covered < area * 0.9 || rungs.length < 3) return null;

  // Zig-zag through the rungs in edge order.
  const pts: number[] = [];
  const jumps: number[] = [];
  let pos = start;
  // Start at the rung nearest the needle, keeping the edge order after it.
  const m = rungs.length / 4;
  let first = 0, bd = Infinity;
  for (let j = 0; j < m; j++) {
    const d = Math.min((rungs[j * 4] - pos[0]) ** 2 + (rungs[j * 4 + 1] - pos[1]) ** 2, (rungs[j * 4 + 2] - pos[0]) ** 2 + (rungs[j * 4 + 3] - pos[1]) ** 2);
    if (d < bd) { bd = d; first = j; }
  }
  for (let q = 0; q < m; q++) {
    const j = (first + q) % m;
    let ax = rungs[j * 4], ay = rungs[j * 4 + 1], bx = rungs[j * 4 + 2], by = rungs[j * 4 + 3];
    if ((bx - pos[0]) ** 2 + (by - pos[1]) ** 2 < (ax - pos[0]) ** 2 + (ay - pos[1]) ** 2) {
      [ax, ay, bx, by] = [bx, by, ax, ay];
    }
    if (q === 0 || Math.hypot(ax - pos[0], ay - pos[1]) > connectorMax) jumps.push(pts.length / 2);
    pts.push(ax, ay);
    const len = Math.hypot(bx - ax, by - ay);
    if (len > maxStitch) {
      const parts = Math.ceil(len / maxStitch);
      const shift = (q & 1 ? 0.3 : -0.3) / parts;
      for (let p = 1; p < parts; p++) pts.push(ax + (bx - ax) * (p / parts + shift), ay + (by - ay) * (p / parts + shift));
    }
    pts.push(bx, by);
    pos = [bx, by];
  }
  return { pts, jumps };
}

export interface ColumnOpts {
  /** Distance between consecutive satin stitches along the stroke (px). */
  spacing: number;
  /** Rungs longer than this end a column (px). */
  maxWidth: number;
  /** Pull compensation added to both ends of every rung (px). */
  extend: number;
  /** Satin stitches longer than this are split (px). */
  maxStitch: number;
  /** Centre walk (+ zigzag on wide columns) under each column. */
  underlay: boolean;
  /** px per mm, for the underlay's fixed-size steps. */
  ppm: number;
}

export interface Column {
  /** Underlay needle points (px), sewn first. */
  under: number[];
  /** Satin needle points (px), sewn straight after the underlay. */
  top: number[];
}

/**
 * Lettering satin: split a stroke shape into columns and zig-zag across each
 * one, the way a digitizer sews type. Each column is marched along the
 * stroke's centreline; at every step the rung is the shortest chord through
 * the centre point within ±25° of the previous one, which keeps stitches
 * square to the stroke around curves (an "O" turns smoothly instead of
 * fanning from the edge) and lets the column stop where a junction or the
 * end of the stroke makes the chord jump. Underlay is a centre walk out and,
 * on wide columns, a sparse zig-zag back, so the satin sits up on top.
 *
 * Pixels no column reached (junction corners, stroke tips) are returned in
 * `leftover` for the caller to sew with a fixed-angle satin.
 */
export function columnSatin(
  comp: Int32Array, dist: Float32Array, w: number, h: number, box: CompBox,
  start: [number, number], o: ColumnOpts,
): { columns: Column[]; leftover: Uint8Array; end: [number, number] } {
  const id = box.id;
  const inside = (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    return xi >= 0 && yi >= 0 && xi < w && yi < h && comp[yi * w + xi] === id;
  };
  const occ = new Uint8Array(w * h);
  const tried = new Uint8Array(w * h);
  const STEP = 0.35;

  /** Cast a chord through (px, py) at angle a; null if it can't be measured. */
  const chord = (px: number, py: number, a: number) => {
    const c = Math.cos(a), s = Math.sin(a);
    let l0 = 0, l1 = 0;
    while (l0 < o.maxWidth * 1.5 && inside(px - c * (l0 + STEP), py - s * (l0 + STEP))) l0 += STEP;
    while (l1 < o.maxWidth * 1.5 && inside(px + c * (l1 + STEP), py + s * (l1 + STEP))) l1 += STEP;
    l0 += STEP * 0.5; l1 += STEP * 0.5;
    return { ax: px - c * l0, ay: py - s * l0, bx: px + c * l1, by: py + s * l1, len: l0 + l1, a };
  };
  type Chord = ReturnType<typeof chord>;
  const shortest = (px: number, py: number, a0: number, range: number, steps: number): Chord => {
    let best = chord(px, py, a0);
    for (let k = 1; k <= steps; k++) {
      for (const sg of [-1, 1]) {
        const ch = chord(px, py, a0 + (sg * range * k) / steps);
        if (ch.len < best.len - 1e-6) best = ch;
      }
    }
    return best;
  };
  const occupiedShare = (ch: Chord) => {
    let n = 0, hit = 0;
    for (let f = 0.15; f <= 0.851; f += 0.1) {
      const x = Math.floor(ch.ax + (ch.bx - ch.ax) * f), y = Math.floor(ch.ay + (ch.by - ch.ay) * f);
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      n++;
      if (occ[y * w + x]) hit++;
    }
    return n ? hit / n : 1;
  };
  // Mark the quad between two consecutive rungs (two triangles, so crossed
  // rungs on the inside of tight curves still mark something sensible).
  const markTri = (x0: number, y0: number, x1: number, y1: number, x2: number, y2: number) => {
    const minX = Math.max(box.minX, Math.floor(Math.min(x0, x1, x2))), maxX = Math.min(box.maxX, Math.ceil(Math.max(x0, x1, x2)));
    const minY = Math.max(box.minY, Math.floor(Math.min(y0, y1, y2))), maxY = Math.min(box.maxY, Math.ceil(Math.max(y0, y1, y2)));
    const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    if (Math.abs(area) < 1e-6) return;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5, py = y + 0.5;
        const e0 = ((x1 - x0) * (py - y0) - (y1 - y0) * (px - x0)) * area;
        const e1 = ((x2 - x1) * (py - y1) - (y2 - y1) * (px - x1)) * area;
        const e2 = ((x0 - x2) * (py - y2) - (y0 - y2) * (px - x2)) * area;
        if (e0 >= 0 && e1 >= 0 && e2 >= 0) {
          const i = y * w + x;
          if (comp[i] === id) occ[i] = 1;
        }
      }
    }
  };
  const markBand = (ch: Chord, half: number) => {
    const nx = -Math.sin(ch.a) * half, ny = Math.cos(ch.a) * half;
    markTri(ch.ax - nx, ch.ay - ny, ch.bx - nx, ch.by - ny, ch.bx + nx, ch.by + ny);
    markTri(ch.ax - nx, ch.ay - ny, ch.bx + nx, ch.by + ny, ch.ax + nx, ch.ay + ny);
  };
  const markQuad = (p: Chord, q: Chord) => {
    markTri(p.ax, p.ay, p.bx, p.by, q.bx, q.by);
    markTri(p.ax, p.ay, q.bx, q.by, q.ax, q.ay);
    markTri(p.ax, p.ay, q.bx, q.by, p.bx, p.by);
    markTri(p.ax, p.ay, q.ax, q.ay, q.bx, q.by);
  };

  /** March from a centre point along ±dir; returns the rungs in order. */
  const march = (first: Chord, dir: 1 | -1, commit: boolean): Chord[] => {
    const out: Chord[] = [];
    let cur = first;
    let tx = -Math.sin(cur.a) * dir, ty = Math.cos(cur.a) * dir;
    let avgLen = cur.len;
    for (let guard = 0; guard < 4000; guard++) {
      if (cur.len > o.maxWidth || occupiedShare(cur) > 0.5) break;
      if (out.length && cur.len > Math.max(avgLen * 1.7, avgLen + 4)) break;
      out.push(cur);
      if (commit) {
        if (out.length === 1) markBand(cur, o.spacing * 0.5);
        else markQuad(out[out.length - 2], cur);
      }
      avgLen = out.length === 1 ? cur.len : avgLen * 0.75 + cur.len * 0.25;
      const mx = (cur.ax + cur.bx) / 2, my = (cur.ay + cur.by) / 2;
      const nx = mx + tx * o.spacing, ny = my + ty * o.spacing;
      if (!inside(nx, ny)) break;
      // Shortest chord near the previous angle, re-centred on the stroke.
      let next = shortest(nx, ny, cur.a, (25 * Math.PI) / 180, 5);
      const cx = (next.ax + next.bx) / 2, cy = (next.ay + next.by) / 2;
      if (inside(cx, cy)) next = shortest(cx, cy, next.a, (6 * Math.PI) / 180, 2);
      // Keep marching forward even if the chord flipped by ~180°.
      let ntx = -Math.sin(next.a), nty = Math.cos(next.a);
      if (ntx * tx + nty * ty < 0) { ntx = -ntx; nty = -nty; }
      // Never step backwards (a chord that recentres behind us).
      const ncx = (next.ax + next.bx) / 2, ncy = (next.ay + next.by) / 2;
      if ((ncx - mx) * tx + (ncy - my) * ty < o.spacing * 0.3) break;
      tx = ntx; ty = nty;
      cur = next;
    }
    return out;
  };

  // Ridge pixels (local maxima of the distance field) seed the columns.
  const ridge: number[] = [];
  for (let y = Math.max(1, box.minY); y <= Math.min(h - 2, box.maxY); y++) {
    for (let x = Math.max(1, box.minX); x <= Math.min(w - 2, box.maxX); x++) {
      const i = y * w + x;
      if (comp[i] !== id || dist[i] < 1.2) continue;
      const d = dist[i] + 0.34;
      if (d >= dist[i - 1] && d >= dist[i + 1] && d >= dist[i - w] && d >= dist[i + w] &&
          d >= dist[i - w - 1] && d >= dist[i - w + 1] && d >= dist[i + w - 1] && d >= dist[i + w + 1]) ridge.push(i);
    }
  }

  const columns: Column[] = [];
  let pos = start;
  for (let guard = 0; guard < 500; guard++) {
    // Nearest untried, unsewn ridge pixel.
    let best = -1, bd = Infinity;
    for (const i of ridge) {
      if (occ[i] || tried[i]) continue;
      const x = (i % w) + 0.5, y = Math.floor(i / w) + 0.5;
      const d = (x - pos[0]) ** 2 + (y - pos[1]) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    if (best < 0) break;
    const sx = (best % w) + 0.5, sy = Math.floor(best / w) + 0.5;
    const r = 2;
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      const xi = Math.floor(sx) + x, yi = Math.floor(sy) + y;
      if (xi >= 0 && yi >= 0 && xi < w && yi < h) tried[yi * w + xi] = 1;
    }
    const seed = shortest(sx, sy, 0, Math.PI / 2, 15);
    if (seed.len > o.maxWidth) continue;
    // Find this stroke's end on one side, then sew from there to the other end.
    const probe = march(seed, 1, false);
    const from = probe.length ? probe[probe.length - 1] : seed;
    const rungs = march(from, -1, true);
    // A column this short is a junction corner; the leftover satin covers it.
    if (rungs.length < 4) continue;
    // Start at whichever end is nearer the needle.
    const a = rungs[0], b = rungs[rungs.length - 1];
    const da = Math.min((a.ax - pos[0]) ** 2 + (a.ay - pos[1]) ** 2, (a.bx - pos[0]) ** 2 + (a.by - pos[1]) ** 2);
    const db = Math.min((b.ax - pos[0]) ** 2 + (b.ay - pos[1]) ** 2, (b.bx - pos[0]) ** 2 + (b.by - pos[1]) ** 2);
    if (db < da) rungs.reverse();
    const col = sewColumn(rungs, o);
    columns.push(col);
    pos = [col.top[col.top.length - 2], col.top[col.top.length - 1]];
  }

  const leftover = new Uint8Array(w * h);
  for (let y = box.minY; y <= box.maxY; y++) {
    for (let x = box.minX; x <= box.maxX; x++) {
      const i = y * w + x;
      if (comp[i] === id && !occ[i]) leftover[i] = 1;
    }
  }
  return { columns, leftover, end: pos };
}

interface Rung { ax: number; ay: number; bx: number; by: number; len: number }

function sewColumn(rungs: Rung[], o: ColumnOpts): Column {
  const under: number[] = [];
  const mid = (r: Rung): [number, number] => [(r.ax + r.bx) / 2, (r.ay + r.by) / 2];
  const extend = (r: Rung, e: number) => {
    const l = r.len || 1;
    const ux = (r.bx - r.ax) / l, uy = (r.by - r.ay) / l;
    return [r.ax - ux * e, r.ay - uy * e, r.bx + ux * e, r.by + uy * e];
  };
  let order = rungs;
  if (o.underlay) {
    // Centre walk out, ~2 mm stitches.
    const runLen = 2 * o.ppm;
    let acc = Infinity;
    let prev = mid(rungs[0]);
    for (let i = 0; i < rungs.length; i++) {
      const m = mid(rungs[i]);
      acc += Math.hypot(m[0] - prev[0], m[1] - prev[1]);
      prev = m;
      if (acc >= runLen || i === rungs.length - 1) { under.push(m[0], m[1]); acc = 0; }
    }
    const meanLen = rungs.reduce((s, r) => s + r.len, 0) / rungs.length;
    if (meanLen > 1.8 * o.ppm) {
      // Zig-zag back, inset from the edges, ~1.2 mm apart.
      const inset = 0.35 * o.ppm;
      const every = Math.max(1, Math.round((1.2 * o.ppm) / o.spacing));
      let side = 0;
      for (let i = rungs.length - 1; i >= 0; i -= every) {
        const e = extend(rungs[i], -inset);
        if (side) under.push(e[0], e[1]); else under.push(e[2], e[3]);
        side ^= 1;
      }
    } else {
      // Narrow: the walk ends at the far end, so sew the satin back.
      order = rungs.slice().reverse();
    }
  }
  // Short stitches: on the inside of a tight curve the rung ends bunch up.
  // There, skip the pull compensation and pull every other stitch back so
  // the ends don't pile into one point (inkstitch's short-stitch inset).
  const n = order.length;
  const gap = (i: number, side: 0 | 1) => {
    const j = i > 0 ? i - 1 : Math.min(n - 1, 1);
    if (j === i) return o.spacing;
    const r = order[i], q = order[j];
    return side ? Math.hypot(r.bx - q.bx, r.by - q.by) : Math.hypot(r.ax - q.ax, r.ay - q.ay);
  };
  const ends = (i: number) => {
    const r = order[i];
    const l = r.len || 1;
    const ux = (r.bx - r.ax) / l, uy = (r.by - r.ay) / l;
    const off = (side: 0 | 1) => {
      const g = gap(i, side) / o.spacing;
      if (g >= 0.75) return -o.extend; // outward
      return i & 1 ? Math.min(0.4, 0.6 * (1 - g)) * l : 0;
    };
    const oa = off(0), ob = off(1);
    return [r.ax + ux * oa, r.ay + uy * oa, r.bx - ux * ob, r.by - uy * ob];
  };
  // Zig-zag satin: alternate rails every rung.
  const top: number[] = [];
  for (let i = 0; i < order.length; i++) {
    const e = ends(i);
    const [x0, y0, x1, y1] = i & 1 ? [e[2], e[3], e[0], e[1]] : [e[0], e[1], e[2], e[3]];
    if (i === 0) top.push(x0, y0);
    const len = Math.hypot(x1 - top[top.length - 2], y1 - top[top.length - 1]);
    if (len > o.maxStitch) {
      const sxp = top[top.length - 2], syp = top[top.length - 1];
      const parts = Math.ceil(len / o.maxStitch);
      const shift = (i & 1 ? 0.3 : -0.3) / parts;
      for (let p = 1; p < parts; p++) top.push(sxp + (x1 - sxp) * (p / parts + shift), syp + (y1 - syp) * (p / parts + shift));
    }
    top.push(x1, y1);
  }
  return { under, top };
}
