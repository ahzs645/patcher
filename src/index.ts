// Patcher as a library: everything the app uses, for other apps to embed.
//
//   import { createDigitizer, renderTextured, writeDst } from 'patcher';
//   const digitizer = createDigitizer();
//   const result = await digitizer.digitize(svgText, { widthMm: 90 });
//   const canvas = renderTextured(result, { scale: 8, lightDeg: 225, colors: result.palette, borderColor: result.borderColor });
//   const dst = writeDst(result, 'patch');
//
// The patch library (SVG patch art grouped by organization) is a separate
// entry, 'patcher/library', so apps that only digitize don't carry it.

export * from './types';
export { createDigitizer, DEFAULT_PAD_MM, type Digitizer, type DigitizeOptions } from './digitizer';
export { loadSvg, rasterize, type LoadedSvg } from './svg';
export { digitize } from './digitize';
export { renderTextured, blockColor, type TexturedOptions, type Finish } from './render/textured';
export { renderPlan } from './render/plan';
export { writeDst } from './export/dst';
export { writeExp } from './export/exp';
export { machineStitches, machineStats, type MachineStitch, type MachineStats } from './export/machine';
export { buildPatchSvg } from './patchSvg';
export { THREAD_CHARTS, nearestThread, type ThreadEntry } from './threadCharts';
