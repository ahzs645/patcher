// Photoreal-ish embroidery render on a 2D canvas.
//
// Each stitch is stamped as a pre-shaded thread sprite (the approach used by
// ThreadText), picked from a handful of brightness variants based on the
// stitch angle relative to the light — that anisotropic sheen is what makes
// fills at different angles read as distinct areas on a real patch. Stitches
// cast a small offset shadow on what was sewn before them (like the layered
// passes in bastidor's realistic mode), and a relief map from the digitizer
// puffs satin columns and the merrow border up off the twill backing.

import type { DigitizeResult, StitchKind } from '../types';

export interface TexturedOptions {
  /** Output resolution, px per mm. */
  scale: number;
  /** Light azimuth in degrees (0 = from the right, 225 = from top-left). */
  lightDeg: number;
  /** Per-palette colour overrides. */
  colors: string[];
  borderColor: string | null;
  /** Draw only the first N needle points (sew-out animation). */
  limit?: number;
  /** Include drop shadow under the patch. */
  dropShadow: boolean;
  /** 'matte' = cotton/poly patch thread; 'glossy' = rayon satin sheen. */
  finish: Finish;
}

export type Finish = 'matte' | 'glossy';

const THREAD_WIDTH_MM: Record<StitchKind, number> = { underlay: 0.35, fill: 0.5, satin: 0.42, border: 0.85 };
const VARIANTS = 12;

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function shade([r, g, b]: [number, number, number], k: number): string {
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(k >= 1 ? v + (255 - v) * (k - 1) * 0.9 : v * k)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

/** Length/width ratios pre-rendered for matte sprites, so fibres are never visibly stretched. */
const ASPECTS = [1.5, 2.5, 4, 6.5, 10, 16];
const INSTANCES = 3;

type SpritePick = (variant: number, aspect: number, r: number) => HTMLCanvasElement;
const spriteCache = new Map<string, SpritePick>();

function capsule(g: CanvasRenderingContext2D, W: number, H: number) {
  const r = H / 2;
  g.beginPath();
  g.moveTo(r, 0);
  g.lineTo(W - r, 0);
  g.arc(W - r, r, r, -Math.PI / 2, Math.PI / 2);
  g.lineTo(r, H);
  g.arc(r, r, r, Math.PI / 2, (3 * Math.PI) / 2);
  g.closePath();
}

/**
 * Matte thread (cotton/poly, as on a real patch). Following inkstitch's
 * realistic filter and ThreadText, shading only ever *darkens* the thread
 * colour — a broad diffuse lobe, never a highlight lerped toward white, which
 * is what reads as glossy satin. Ply twist is drawn at a fixed pitch, with
 * several random instances so neighbouring stitches never line up (the
 * random UV offset trick from dst-format).
 */
function matteSprite(rgb: [number, number, number], b: number, aspect: number, border: boolean, seed: number) {
  const H = border ? 18 : 12;
  const W = Math.round(H * aspect);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const rnd = mulberry32(seed);
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, shade(rgb, 0.5 * b));
  grad.addColorStop(0.22, shade(rgb, 0.8 * b));
  grad.addColorStop(0.45, shade(rgb, 1.0 * b));
  grad.addColorStop(0.72, shade(rgb, 0.84 * b));
  grad.addColorStop(1, shade(rgb, 0.48 * b));
  g.fillStyle = grad;
  capsule(g, W, H);
  g.fill();

  g.save();
  g.globalCompositeOperation = 'source-atop';
  // Ply grooves: dark diagonal valleys between the twisted plies.
  const pitch = H * 0.42;
  const slant = H * 0.8;
  const off = rnd() * pitch;
  g.lineCap = 'round';
  for (let x = -slant - pitch + off; x < W + pitch; x += pitch) {
    g.strokeStyle = `rgba(0,0,0,${0.16 + rnd() * 0.08})`;
    g.lineWidth = H * 0.09;
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x + slant, H); g.stroke();
    // Soft lit crest of each ply, a darkening-free lift of at most ~6%.
    g.strokeStyle = `rgba(255,255,255,${0.03 + rnd() * 0.04})`;
    g.lineWidth = H * 0.12;
    g.beginPath(); g.moveTo(x + pitch * 0.5, 0); g.lineTo(x + pitch * 0.5 + slant, H); g.stroke();
  }
  // Loose fibres / fuzz.
  const fibres = Math.round(W * H * 0.035);
  for (let k = 0; k < fibres; k++) {
    const x = rnd() * W, y = rnd() * H, len = H * (0.2 + rnd() * 0.5);
    g.strokeStyle = rnd() < 0.55 ? `rgba(0,0,0,${0.06 + rnd() * 0.1})` : `rgba(255,255,255,${0.03 + rnd() * 0.05})`;
    g.lineWidth = 0.5 + rnd() * 0.6;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + len * 0.6, y + len * 0.8); g.stroke();
  }
  // Thread tucks into the needle hole at each end.
  const ends = g.createLinearGradient(0, 0, W, 0);
  const e = Math.min(0.3, (H * 0.6) / W);
  ends.addColorStop(0, 'rgba(0,0,0,0.4)');
  ends.addColorStop(e, 'rgba(0,0,0,0)');
  ends.addColorStop(1 - e, 'rgba(0,0,0,0)');
  ends.addColorStop(1, 'rgba(0,0,0,0.4)');
  g.fillStyle = ends;
  g.fillRect(0, 0, W, H);
  g.restore();
  return c;
}

/** Glossy rayon: bright specular band and fine regular twist. */
function glossySprite(rgb: [number, number, number], b: number, border: boolean) {
  const W = 64, H = border ? 20 : 14;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, shade(rgb, 0.38 * b));
  grad.addColorStop(0.3, shade(rgb, 0.95 * b));
  grad.addColorStop(0.42, shade(rgb, 1.12 * b));
  grad.addColorStop(0.6, shade(rgb, 0.9 * b));
  grad.addColorStop(1, shade(rgb, 0.35 * b));
  g.fillStyle = grad;
  capsule(g, W, H);
  g.fill();
  g.save();
  g.globalCompositeOperation = 'source-atop';
  g.lineWidth = 1;
  for (let x = -H; x < W + H; x += border ? 4 : 3.2) {
    g.strokeStyle = 'rgba(255,255,255,0.10)';
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x + H * 0.7, H); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.12)';
    g.beginPath(); g.moveTo(x + 1.4, 0); g.lineTo(x + 1.4 + H * 0.7, H); g.stroke();
  }
  const ends = g.createLinearGradient(0, 0, W, 0);
  ends.addColorStop(0, 'rgba(0,0,0,0.45)');
  ends.addColorStop(0.1, 'rgba(0,0,0,0)');
  ends.addColorStop(0.9, 'rgba(0,0,0,0)');
  ends.addColorStop(1, 'rgba(0,0,0,0.45)');
  g.fillStyle = ends;
  g.fillRect(0, 0, W, H);
  g.restore();
  return c;
}

/** Sprite picker for one thread colour: (brightness variant, stitch aspect, random) → canvas. */
function threadSprites(hex: string, border: boolean, finish: Finish): SpritePick {
  const key = `${hex}:${border ? 'b' : 's'}:${finish}`;
  const hit = spriteCache.get(key);
  if (hit) return hit;
  const rgb = hexToRgb(hex);
  let pick: SpritePick;
  if (finish === 'matte') {
    const table: HTMLCanvasElement[][][] = [];
    for (let v = 0; v < VARIANTS; v++) {
      const bright = 0.8 + (v / (VARIANTS - 1)) * 0.22;
      table.push(ASPECTS.map((a, ai) =>
        Array.from({ length: INSTANCES }, (_, k) => matteSprite(rgb, bright, a, border, v * 131 + ai * 17 + k * 7 + 1))));
    }
    pick = (v, aspect, r) => {
      let ai = 0;
      while (ai < ASPECTS.length - 1 && aspect > (ASPECTS[ai] + ASPECTS[ai + 1]) / 2) ai++;
      return table[v][ai][Math.floor(r * INSTANCES) % INSTANCES];
    };
  } else {
    const list = Array.from({ length: VARIANTS }, (_, v) => glossySprite(rgb, 0.62 + (v / (VARIANTS - 1)) * 0.62, border));
    pick = (v) => list[v];
  }
  spriteCache.set(key, pick);
  return pick;
}

function twillPattern(ctx: CanvasRenderingContext2D, hex: string, scale: number): CanvasPattern {
  const s = Math.max(4, Math.round(scale * 0.8));
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d')!;
  const rgb = hexToRgb(hex);
  g.fillStyle = shade(rgb, 0.9);
  g.fillRect(0, 0, s, s);
  g.strokeStyle = shade(rgb, 0.7);
  g.lineWidth = s / 3;
  g.beginPath();
  g.moveTo(-s, s * 2); g.lineTo(s * 2, -s);
  g.moveTo(0, s * 2); g.lineTo(s * 2, 0);
  g.moveTo(-s, s); g.lineTo(s, -s);
  g.stroke();
  return ctx.createPattern(c, 'repeat')!;
}

function outlinePath(result: DigitizeResult, scale: number): Path2D {
  const p = new Path2D();
  for (const o of result.outlines) {
    for (let i = 0; i < o.length; i += 2) {
      if (i === 0) p.moveTo(o[0] * scale, o[1] * scale);
      else p.lineTo(o[i] * scale, o[i + 1] * scale);
    }
    p.closePath();
  }
  return p;
}

/** Small deterministic PRNG so re-renders don't shimmer. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function blockColor(result: DigitizeResult, opts: { colors: string[]; borderColor: string | null }, bi: number): string {
  const b = result.blocks[bi];
  if (b.kind === 'border') return opts.borderColor ?? (b.paletteIndex >= 0 ? opts.colors[b.paletteIndex] : b.color);
  return b.paletteIndex >= 0 ? opts.colors[b.paletteIndex] ?? b.color : b.color;
}

export function renderTextured(result: DigitizeResult, opts: TexturedOptions, target?: HTMLCanvasElement): HTMLCanvasElement {
  const { scale } = opts;
  const W = Math.round(result.widthMm * scale), H = Math.round(result.heightMm * scale);
  const canvas = target ?? document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;

  const patch = document.createElement('canvas');
  patch.width = W;
  patch.height = H;
  const ctx = patch.getContext('2d')!;
  const outline = outlinePath(result, scale);

  // Twill backing, visible only where nothing is stitched.
  const main = result.coverage.indexOf(Math.max(...result.coverage));
  ctx.fillStyle = twillPattern(ctx, opts.colors[main] ?? '#777777', scale);
  ctx.fill(outline);

  const la = (opts.lightDeg * Math.PI) / 180;
  const shadowOff = 0.14 * scale;
  const sx = -Math.cos(la) * shadowOff, sy = -Math.sin(la) * shadowOff;
  const rnd = mulberry32(1234);
  let budget = opts.limit ?? Infinity;
  const matte = opts.finish === 'matte';

  for (let bi = 0; bi < result.blocks.length && budget > 0; bi++) {
    const b = result.blocks[bi];
    const hex = blockColor(result, opts, bi);
    const sprites = threadSprites(hex, b.kind === 'border', opts.finish);
    const tw = THREAD_WIDTH_MM[b.kind] * scale;
    const pts = b.points;
    const n = Math.min(pts.length / 2, budget);
    budget -= n;
    const jumpSet = new Set(b.jumps);

    // Shadow cast by this block onto everything sewn before it.
    if (b.kind !== 'underlay') {
      const shadow = new Path2D();
      for (let i = 1; i < n; i++) {
        if (jumpSet.has(i)) continue;
        shadow.moveTo(pts[i * 2 - 2] * scale + sx, pts[i * 2 - 1] * scale + sy);
        shadow.lineTo(pts[i * 2] * scale + sx, pts[i * 2 + 1] * scale + sy);
      }
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = b.kind === 'border' ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.3)';
      ctx.lineWidth = tw * 1.15;
      ctx.stroke(shadow);
      ctx.restore();
    }

    for (let i = 1; i < n; i++) {
      if (jumpSet.has(i)) continue;
      const x0 = pts[i * 2 - 2] * scale, y0 = pts[i * 2 - 1] * scale;
      const x1 = pts[i * 2] * scale, y1 = pts[i * 2 + 1] * scale;
      const dx = x1 - x0, dy = y1 - y0;
      const len = Math.hypot(dx, dy);
      if (len < 0.3) continue;
      const ang = Math.atan2(dy, dx);
      // Sheen: brightest when the thread lies across the light.
      const sheen = Math.abs(Math.sin(ang - la));
      // Matte: angle matters less, random per-stitch variation (±~9%) more.
      let v = matte
        ? Math.round((0.35 + 0.4 * sheen) * (VARIANTS - 1) + (rnd() - 0.5) * 4)
        : Math.round((0.15 + 0.8 * sheen) * (VARIANTS - 1) + (rnd() - 0.5) * 2.2);
      v = v < 0 ? 0 : v >= VARIANTS ? VARIANTS - 1 : v;
      const c = dx / len, s = dy / len;
      // Glossy: overlap neighbours. Matte: stop just short of each needle
      // hole (inkstitch trims 0.2 mm) so the fill reads as individual stitches.
      const ext = matte ? tw * 0.12 - Math.min(0.06 * scale, len * 0.15) : tw * 0.35;
      const drawLen = len + ext * 2;
      ctx.setTransform(c, s, -s, c, x0 - c * ext, y0 - s * ext);
      ctx.drawImage(sprites(v, drawLen / tw, rnd()), 0, -tw / 2, drawLen, tw);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // The relief map describes the finished patch; during a partial sew-out it
  // would emboss areas that aren't stitched yet.
  if (opts.limit === undefined) applyRelief(ctx, result, opts, W, H);
  if (opts.finish === 'matte') applyGrain(ctx, W, H, scale);

  const out = canvas.getContext('2d')!;
  out.clearRect(0, 0, W, H);
  if (opts.dropShadow) {
    out.save();
    out.shadowColor = 'rgba(0,0,0,0.45)';
    out.shadowBlur = 1.6 * scale;
    out.shadowOffsetX = -Math.cos(la) * 0.7 * scale;
    out.shadowOffsetY = -Math.sin(la) * 0.7 * scale;
    out.drawImage(patch, 0, 0);
    out.restore();
  } else {
    out.drawImage(patch, 0, 0);
  }
  return canvas;
}

/** Light the relief map and lay it over the stitched pixels only. */
function applyRelief(ctx: CanvasRenderingContext2D, result: DigitizeResult, opts: TexturedOptions, W: number, H: number) {
  const { rasterW: rw, rasterH: rh, height } = result;
  // Light blur so steps between regions read as soft puffs, not hard lines.
  const hb = new Float32Array(rw * rh);
  const tmp = new Float32Array(rw * rh);
  const R = Math.max(1, Math.round(result.pxPerMm * 0.25));
  for (let y = 0; y < rh; y++) {
    let acc = 0;
    for (let x = -R; x <= R; x++) acc += height[y * rw + Math.min(rw - 1, Math.max(0, x))];
    for (let x = 0; x < rw; x++) {
      tmp[y * rw + x] = acc / (2 * R + 1);
      acc += height[y * rw + Math.min(rw - 1, x + R + 1)] - height[y * rw + Math.max(0, x - R)];
    }
  }
  for (let x = 0; x < rw; x++) {
    let acc = 0;
    for (let y = -R; y <= R; y++) acc += tmp[Math.min(rh - 1, Math.max(0, y)) * rw + x];
    for (let y = 0; y < rh; y++) {
      hb[y * rw + x] = acc / (2 * R + 1);
      acc += tmp[Math.min(rh - 1, y + R + 1) * rw + x] - tmp[Math.max(0, y - R) * rw + x];
    }
  }

  const la = (opts.lightDeg * Math.PI) / 180;
  // Light comes *from* lightDeg, so surfaces facing that way brighten.
  const lx = Math.cos(la), ly = Math.sin(la);
  const img = new ImageData(rw, rh);
  const d = img.data;
  const k = result.pxPerMm * (opts.finish === 'matte' ? 1.2 : 1.6);
  // Matte thread scatters light: raised areas lighten much less.
  const hiK = opts.finish === 'matte' ? 0.3 : 1;
  for (let y = 1; y < rh - 1; y++) {
    for (let x = 1; x < rw - 1; x++) {
      const i = y * rw + x;
      const gx = (hb[i + 1] - hb[i - 1]) * 0.5 * k;
      const gy = (hb[i + rw] - hb[i - rw]) * 0.5 * k;
      // Surface normal ≈ (-gx, -gy, 1); dot with light (lx, ly, ~0.7).
      let s = -(gx * lx + gy * ly) / Math.sqrt(1 + gx * gx + gy * gy);
      // Ambient occlusion in the valleys between areas.
      s -= Math.max(0, 0.3 - hb[i]) * 1.2;
      const o = i * 4;
      if (s >= 0) { d[o] = d[o + 1] = d[o + 2] = 255; d[o + 3] = Math.min(150, s * 170 * hiK); }
      else { d[o + 3] = Math.min(190, -s * 230); }
    }
  }
  const rc = document.createElement('canvas');
  rc.width = rw;
  rc.height = rh;
  rc.getContext('2d')!.putImageData(img, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(rc, 0, 0, W, H);
  ctx.restore();
}

/**
 * Fine fibre grain over the stitched area: low-contrast value noise at thread
 * scale. Real patch thread is fuzzy; this kills the last of the CG smoothness.
 */
const grainCache = new Map<number, HTMLCanvasElement>();
function applyGrain(ctx: CanvasRenderingContext2D, W: number, H: number, scale: number) {
  const tile = 256;
  let c = grainCache.get(tile);
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = tile;
    const g = c.getContext('2d')!;
    const img = g.createImageData(tile, tile);
    const rnd = mulberry32(99);
    for (let i = 0; i < tile * tile; i++) {
      const v = rnd();
      const o = i * 4;
      const light = v > 0.5;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = light ? 255 : 0;
      img.data[o + 3] = Math.round(Math.abs(v - 0.5) * 2 * (light ? 26 : 40));
    }
    g.putImageData(img, 0, 0);
    grainCache.set(tile, c);
  }
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  // Grain roughly one fibre (~0.08 mm) per noise texel.
  const k = Math.max(1, scale * 0.08);
  ctx.scale(k, k);
  ctx.fillStyle = ctx.createPattern(c, 'repeat')!;
  ctx.fillRect(0, 0, W / k, H / k);
  ctx.restore();
}
