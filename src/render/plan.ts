// Stitch-plan view: the needle path as plain coloured lines, jumps dashed.

import type { DigitizeResult } from '../types';
import { blockColor } from './textured';

export function renderPlan(
  result: DigitizeResult,
  opts: { scale: number; colors: string[]; borderColor: string | null; showJumps: boolean; limit?: number },
  target: HTMLCanvasElement,
) {
  const { scale } = opts;
  target.width = Math.round(result.widthMm * scale);
  target.height = Math.round(result.heightMm * scale);
  const ctx = target.getContext('2d')!;
  ctx.fillStyle = '#fbfaf7';
  ctx.fillRect(0, 0, target.width, target.height);
  ctx.lineWidth = Math.max(0.8, scale * 0.14);
  ctx.lineJoin = 'round';

  const jumps = new Path2D();
  let last: [number, number] | null = null;
  let budget = opts.limit ?? Infinity;
  result.blocks.forEach((b, bi) => {
    if (budget <= 0) return;
    const pts = b.points;
    const jumpSet = new Set(b.jumps);
    const path = new Path2D();
    const n = Math.min(pts.length / 2, budget);
    budget -= n;
    for (let i = 0; i < n; i++) {
      const x = pts[i * 2] * scale, y = pts[i * 2 + 1] * scale;
      if (i === 0 || jumpSet.has(i)) {
        if (last) { jumps.moveTo(last[0], last[1]); jumps.lineTo(x, y); }
        path.moveTo(x, y);
      } else path.lineTo(x, y);
      last = [x, y];
    }
    ctx.strokeStyle = blockColor(result, opts, bi);
    ctx.globalAlpha = b.kind === 'underlay' ? 0.35 : 1;
    ctx.stroke(path);
    ctx.globalAlpha = 1;
  });
  if (opts.showJumps) {
    ctx.save();
    ctx.setLineDash([scale * 0.6, scale * 0.5]);
    ctx.strokeStyle = 'rgba(120,120,120,0.55)';
    ctx.lineWidth = Math.max(0.5, scale * 0.05);
    ctx.stroke(jumps);
    ctx.restore();
  }
}
