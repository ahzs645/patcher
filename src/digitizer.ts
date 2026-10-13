// SVG in, stitches out: the whole pipeline behind one call, for this app and
// for anything that embeds Patcher (see src/index.ts).
//
// Rasterising needs the DOM, so it stays on the calling thread; digitizing is
// the slow part and runs in a Web Worker when one is available, falling back to
// the calling thread (tests, SSR, old browsers) when it is not.

import { digitize } from './digitize';
import { loadSvg, rasterize, type LoadedSvg } from './svg';
import { DEFAULT_PARAMS, type DigitizeParams, type DigitizeResult, type RasterInput } from './types';

/** Transparent margin around the art for the merrow lip and shadows. */
export const DEFAULT_PAD_MM = 4;

export interface DigitizeOptions {
  /** Margin around the art in mm (default 4). */
  padMm?: number;
}

export interface Digitizer {
  /** Digitize an SVG (markup or one already loaded with loadSvg). Missing params take the defaults. */
  digitize(svg: string | LoadedSvg, params?: Partial<DigitizeParams>, opts?: DigitizeOptions): Promise<DigitizeResult>;
  /** Digitize a raster already made with rasterize(). */
  digitizeRaster(raster: RasterInput, params: DigitizeParams): Promise<DigitizeResult>;
  /** Stop the worker. The digitizer can't be used afterwards. */
  dispose(): void;
}

type Reply = { id: number; result?: DigitizeResult; error?: string };

function startWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null;
  try {
    return new Worker(new URL('./digitize/worker.ts', import.meta.url), { type: 'module' });
  } catch {
    return null;
  }
}

export function createDigitizer(opts: { worker?: boolean } = {}): Digitizer {
  const worker = opts.worker === false ? null : startWorker();
  const pending = new Map<number, (r: Reply) => void>();
  let nextId = 0;
  if (worker) {
    worker.onmessage = (e: MessageEvent<Reply>) => {
      const cb = pending.get(e.data.id);
      pending.delete(e.data.id);
      cb?.(e.data);
    };
  }

  const digitizeRaster = async (raster: RasterInput, params: DigitizeParams): Promise<DigitizeResult> => {
    if (!worker) return digitize(raster, params);
    const id = ++nextId;
    const msg = await new Promise<Reply>((resolve) => {
      pending.set(id, resolve);
      const transfer: Transferable[] = [raster.data.buffer];
      if (raster.textMask) transfer.push(raster.textMask.buffer);
      worker.postMessage({ id, raster, params }, transfer);
    });
    if (msg.error || !msg.result) throw new Error(msg.error || 'Digitizing failed');
    return msg.result;
  };

  return {
    digitizeRaster,
    async digitize(svg, params = {}, o = {}) {
      const loaded = typeof svg === 'string' ? loadSvg(svg) : svg;
      const full: DigitizeParams = { ...DEFAULT_PARAMS, ...params, relief: { ...DEFAULT_PARAMS.relief, ...params.relief } };
      try {
        const raster = await rasterize(loaded, full.widthMm, full.pxPerMm, o.padMm ?? DEFAULT_PAD_MM);
        return await digitizeRaster(raster, full);
      } finally {
        if (typeof svg === 'string') URL.revokeObjectURL(loaded.url);
      }
    },
    dispose() {
      worker?.terminate();
      for (const cb of pending.values()) cb({ id: -1, error: 'Digitizer disposed' });
      pending.clear();
    },
  };
}
