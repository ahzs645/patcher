// Machine stitch sequence shared by the file writers: absolute needle moves in
// 0.1 mm (design centred on the hoop origin) with explicit trims, colour
// changes and lock stitches.
//
// - Lock stitches follow inkstitch's default "half_stitch" tie (offsets
//   0 · 0.5 · 1 · 0.5 · 0 × 0.7 mm along the stitch direction) at the start of
//   every run and before every trim, so threads don't unravel on the patch.
// - Jumps up to 3 mm are stitched through instead of trimmed (inkstitch
//   collapse_len); longer ones become trim + jump.

import type { DigitizeResult } from '../types';

export type Cmd = 'stitch' | 'jump' | 'trim' | 'color' | 'end';
export interface MachineStitch { x: number; y: number; cmd: Cmd }

const LOCK = [0.5, 1, 0.5, 0];
const LOCK_MM = 0.7;
const COLLAPSE_MM = 3;

export function machineStitches(result: DigitizeResult, opts: { locks: boolean } = { locks: true }): MachineStitch[] {
  const out: MachineStitch[] = [];
  const cx = result.widthMm / 2, cy = result.heightMm / 2;
  const u = (v: number, c: number) => Math.round((v - c) * 10);
  let prevColor: string | null = null;
  let last: [number, number] | null = null; // mm
  let prevPt: [number, number] | null = null;

  const push = (x: number, y: number, cmd: Cmd) => out.push({ x: u(x, cx), y: u(y, cy), cmd });
  const tie = (at: [number, number], toward: [number, number] | null) => {
    if (!opts.locks || !toward) return;
    const dx = toward[0] - at[0], dy = toward[1] - at[1];
    const l = Math.hypot(dx, dy);
    if (l < 1e-6) return;
    for (const k of LOCK) push(at[0] + (dx / l) * LOCK_MM * k, at[1] + (dy / l) * LOCK_MM * k, 'stitch');
  };

  for (const b of result.blocks) {
    const colorChange = prevColor !== null && b.color !== prevColor;
    const jumps = new Set(b.jumps);
    const n = b.points.length / 2;
    for (let i = 0; i < n; i++) {
      const p: [number, number] = [b.points[i * 2], b.points[i * 2 + 1]];
      const next: [number, number] | null = i + 1 < n ? [b.points[i * 2 + 2], b.points[i * 2 + 3]] : null;
      const startsRun = i === 0 || jumps.has(i);
      if (startsRun) {
        const far = !last || Math.hypot(p[0] - last[0], p[1] - last[1]) > COLLAPSE_MM;
        if (last && (far || (i === 0 && colorChange))) {
          tie(last, prevPt); // tie off the run we're leaving
          out.push({ x: u(last[0], cx), y: u(last[1], cy), cmd: 'trim' });
        }
        if (i === 0 && colorChange) out.push({ x: u(last![0], cx), y: u(last![1], cy), cmd: 'color' });
        if (far || (i === 0 && colorChange)) {
          push(p[0], p[1], 'jump');
          push(p[0], p[1], 'stitch');
          tie(p, next);
        } else push(p[0], p[1], 'stitch');
      } else push(p[0], p[1], 'stitch');
      prevPt = last;
      last = p;
    }
    prevColor = b.color;
  }
  if (last) {
    tie(last, prevPt);
    out.push({ x: u(last[0], cx), y: u(last[1], cy), cmd: 'trim' });
  }
  out.push({ x: out.length ? out[out.length - 1].x : 0, y: out.length ? out[out.length - 1].y : 0, cmd: 'end' });
  return out;
}

/**
 * Relative records with long moves split to the format's limit. The callback
 * receives (dx, dy, cmd) for every emitted record.
 */
export function relative(stitches: MachineStitch[], maxStep: number, emit: (dx: number, dy: number, cmd: Cmd) => void) {
  let px = 0, py = 0;
  for (const s of stitches) {
    if (s.cmd === 'trim' || s.cmd === 'color' || s.cmd === 'end') { emit(0, 0, s.cmd); continue; }
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(s.x - px), Math.abs(s.y - py)) / maxStep));
    const sx = px, sy = py;
    for (let k = 1; k <= steps; k++) {
      const nx = Math.round(sx + ((s.x - sx) * k) / steps), ny = Math.round(sy + ((s.y - sy) * k) / steps);
      emit(nx - px, ny - py, s.cmd);
      px = nx; py = ny;
    }
  }
}

export interface MachineStats {
  stitches: number;
  trims: number;
  colorChanges: number;
  longestMm: number;
  widthMm: number;
  heightMm: number;
}

export function machineStats(stitches: MachineStitch[]): MachineStats {
  let n = 0, trims = 0, colors = 0, longest = 0;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let prev: MachineStitch | null = null;
  for (const s of stitches) {
    if (s.cmd === 'stitch') {
      n++;
      if (prev) longest = Math.max(longest, Math.hypot(s.x - prev.x, s.y - prev.y));
      minX = Math.min(minX, s.x); maxX = Math.max(maxX, s.x);
      minY = Math.min(minY, s.y); maxY = Math.max(maxY, s.y);
    }
    if (s.cmd === 'trim') trims++;
    if (s.cmd === 'color') colors++;
    if (s.cmd === 'stitch' || s.cmd === 'jump') prev = s.cmd === 'stitch' ? s : null;
  }
  return {
    stitches: n, trims, colorChanges: colors, longestMm: longest / 10,
    widthMm: Number.isFinite(minX) ? (maxX - minX) / 10 : 0,
    heightMm: Number.isFinite(minY) ? (maxY - minY) / 10 : 0,
  };
}
