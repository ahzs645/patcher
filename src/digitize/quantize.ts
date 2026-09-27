// Colour reduction: turn the rendered SVG into a small set of thread colours.
//
// Patch art is mostly flat colour, so instead of a generic median-cut (as in
// bastidor's raster.js) we histogram the pixels and greedily keep the most
// common colours that are perceptually distinct. Anti-aliased edge pixels and
// gradient steps are then snapped to the nearest thread and cleaned up by a
// majority filter.

export const TRANSPARENT = 255;

type RGB = [number, number, number];

/** "Redmean" weighted RGB distance — cheap and close enough to perceptual. */
export function colorDist(a: RGB, b: RGB): number {
  const rm = (a[0] + b[0]) / 2;
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db) / 3;
}

export interface Quantized {
  palette: RGB[];
  labels: Uint8Array;
}

export function quantize(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  maxColors: number,
  tolerance: number,
): Quantized {
  const n = width * height;
  const BITS = 5;
  const SHIFT = 8 - BITS;
  const bins = 1 << (BITS * 3);
  const count = new Uint32Array(bins);
  const sum = new Float64Array(bins * 3);
  let opaque = 0;

  for (let i = 0; i < n; i++) {
    const o = i * 4;
    if (data[o + 3] < 128) continue;
    const r = data[o], g = data[o + 1], b = data[o + 2];
    const k = ((r >> SHIFT) << (BITS * 2)) | ((g >> SHIFT) << BITS) | (b >> SHIFT);
    count[k]++;
    sum[k * 3] += r;
    sum[k * 3 + 1] += g;
    sum[k * 3 + 2] += b;
    opaque++;
  }

  const labels = new Uint8Array(n).fill(TRANSPARENT);
  if (!opaque) return { palette: [], labels };

  const order: number[] = [];
  for (let k = 0; k < bins; k++) if (count[k]) order.push(k);
  order.sort((a, b) => count[b] - count[a]);

  // Greedy pick. Minimum share keeps anti-aliasing fringes out of the palette.
  const minShare = opaque * 0.0012;
  const palette: RGB[] = [];
  for (const k of order) {
    if (palette.length >= maxColors) break;
    if (count[k] < minShare && palette.length > 0) break;
    const c: RGB = [sum[k * 3] / count[k], sum[k * 3 + 1] / count[k], sum[k * 3 + 2] / count[k]];
    if (palette.every((p) => colorDist(p, c) > tolerance)) palette.push(c);
  }

  // Assign every opaque pixel, memoised per histogram bin.
  const binLabel = new Int16Array(bins).fill(-1);
  const nearest = (c: RGB) => {
    let best = 0, bd = Infinity;
    for (let j = 0; j < palette.length; j++) {
      const d = colorDist(palette[j], c);
      if (d < bd) { bd = d; best = j; }
    }
    return best;
  };

  // Two refinement rounds: move each thread colour to the mean of the pixels
  // that match it closely (ignoring the blended edge pixels).
  for (let round = 0; round < 2; round++) {
    const acc = new Float64Array(palette.length * 4);
    for (const k of order) {
      const c: RGB = [sum[k * 3] / count[k], sum[k * 3 + 1] / count[k], sum[k * 3 + 2] / count[k]];
      const j = nearest(c);
      if (colorDist(palette[j], c) > tolerance * 0.6) continue;
      acc[j * 4] += sum[k * 3];
      acc[j * 4 + 1] += sum[k * 3 + 1];
      acc[j * 4 + 2] += sum[k * 3 + 2];
      acc[j * 4 + 3] += count[k];
    }
    for (let j = 0; j < palette.length; j++) {
      const c = acc[j * 4 + 3];
      if (c > 0) palette[j] = [acc[j * 4] / c, acc[j * 4 + 1] / c, acc[j * 4 + 2] / c];
    }
  }
  for (const k of order) {
    binLabel[k] = nearest([sum[k * 3] / count[k], sum[k * 3 + 1] / count[k], sum[k * 3 + 2] / count[k]]);
  }

  for (let i = 0; i < n; i++) {
    const o = i * 4;
    if (data[o + 3] < 128) continue;
    const k = ((data[o] >> SHIFT) << (BITS * 2)) | ((data[o + 1] >> SHIFT) << BITS) | (data[o + 2] >> SHIFT);
    labels[i] = binLabel[k];
  }

  majorityFilter(labels, width, height);
  return { palette: palette.map((c) => c.map(Math.round) as RGB), labels };
}

/** One 3x3 majority pass: removes single-pixel speckle left by anti-aliasing. */
function majorityFilter(labels: Uint8Array, w: number, h: number) {
  const src = labels.slice();
  const tally = new Uint8Array(256);
  const seen: number[] = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const cur = src[i];
      if (cur === TRANSPARENT) continue;
      seen.length = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const l = src[i + dy * w + dx];
          if (!tally[l]) seen.push(l);
          tally[l]++;
        }
      }
      let best = cur, bc = tally[cur];
      for (const l of seen) {
        if (l !== TRANSPARENT && tally[l] > bc) { bc = tally[l]; best = l; }
      }
      if (bc >= 5) labels[i] = best;
      for (const l of seen) tally[l] = 0;
    }
  }
}

export function toHex(c: RGB): string {
  return '#' + c.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}
