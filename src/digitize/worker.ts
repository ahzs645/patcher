/// <reference lib="webworker" />
import { digitize } from './index';
import type { DigitizeParams, RasterInput } from '../types';

self.onmessage = (e: MessageEvent<{ id: number; raster: RasterInput; params: DigitizeParams }>) => {
  const { id, raster, params } = e.data;
  try {
    const result = digitize(raster, params);
    const transfer: Transferable[] = [result.height.buffer];
    for (const b of result.blocks) transfer.push(b.points.buffer, b.jumps.buffer);
    for (const o of result.outlines) transfer.push(o.buffer);
    (self as unknown as DedicatedWorkerGlobalScope).postMessage({ id, result }, transfer);
  } catch (err) {
    (self as unknown as DedicatedWorkerGlobalScope).postMessage({ id, error: String((err as Error)?.stack || err) });
  }
};
