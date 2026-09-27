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
