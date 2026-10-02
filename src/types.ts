// Shared types between the main thread, the digitizing worker and the renderers.
// All stitch coordinates are in millimetres, origin at the top-left of the
// padded design area.

export type StitchKind = 'underlay' | 'fill' | 'satin' | 'border';
export type BorderStyle = 'merrow' | 'satin' | 'none';
/** Per-thread relief override: raised = satin sewn on top of the fill around it. */
export type Relief = 'flat' | 'raised';

export interface DigitizeParams {
  /** Finished patch width in mm (height follows the SVG aspect ratio). */
  widthMm: number;
  /** Raster resolution used for colour/region analysis. */
  pxPerMm: number;
  /** Upper bound on the number of thread colours. */
  maxColors: number;
  /** Colours closer than this (perceptual RGB distance) are merged. */
  colorTolerance: number;
  /** Tatami row spacing (density). */
  fillSpacingMm: number;
  /** Tatami stitch length. */
  fillStitchMm: number;
  /** Base tatami angle in degrees. */
  fillAngleDeg: number;
  /** Rotate the fill angle per colour so neighbouring areas catch light differently. */
  varyAngles: boolean;
  /** Regions no wider than this are sewn as satin instead of tatami. */
  satinMaxWidthMm: number;
  /** Satin row spacing. */
  satinSpacingMm: number;
  /** Satin stitches longer than this are split. */
  satinMaxStitchMm: number;
  /** Regions smaller than this are absorbed by their neighbour. */
  minRegionMm2: number;
  /** Lay a sparse tatami at 90° under fills first (loft, stability). */
  underlay: boolean;
  /** Extend every row by this much into neighbouring areas so no fabric shows. */
  pullCompMm: number;
  border: BorderStyle;
  borderWidthMm: number;
  /** null = pick automatically from the art's outer edge. */
  borderColor: string | null;
  /** Sew lettering (SVG <text>, or groups tagged data-live-text) raised: satin columns on top of the fill. */
  raiseText: boolean;
  /** Per-thread overrides keyed by detected colour; absent = automatic (lettering only). */
  relief: Record<string, Relief>;
}

export const DEFAULT_PARAMS: DigitizeParams = {
  widthMm: 90,
  pxPerMm: 8,
  maxColors: 12,
  colorTolerance: 30,
  fillSpacingMm: 0.4,
  fillStitchMm: 3,
  fillAngleDeg: 45,
  varyAngles: true,
  satinMaxWidthMm: 1.6,
  satinSpacingMm: 0.3,
  satinMaxStitchMm: 7,
  minRegionMm2: 0.5,
  underlay: true,
  pullCompMm: 0.2,
  border: 'merrow',
  borderWidthMm: 3,
  borderColor: null,
  raiseText: true,
  relief: {},
};

/** One contiguous colour block: a single region (or the border) sewn in one go. */
export interface StitchBlock {
  color: string;
  /** Index into DigitizeResult.palette (-1 for a border colour not in the art). */
  paletteIndex: number;
  kind: StitchKind;
  /** Flat [x0, y0, x1, y1, ...] needle positions in mm. */
  points: Float32Array;
  /** Part of a raised area (sewn on top of the fill, casts a deeper shadow). */
  raised?: boolean;
  /** Point indices that are reached by a jump (no visible thread from the previous point). */
  jumps: Uint32Array;
}

export interface RasterInput {
  width: number;
  height: number;
  data: Uint8ClampedArray;
  /** Padding (px) added around the art on every side. */
  padPx: number;
  /** 1 where the SVG's lettering covers the pixel (same size as data / 4). */
  textMask?: Uint8Array;
}

export interface DigitizeResult {
  /** Design size in mm including padding. */
  widthMm: number;
  heightMm: number;
  padMm: number;
  pxPerMm: number;
  palette: string[];
  /** Pixel share of each palette entry (0..1). */
  coverage: number[];
  blocks: StitchBlock[];
  /** Patch outlines (mm, closed polygons) — used for the cut edge, shadow and fabric. */
  outlines: Float32Array[];
  /** Relief height map at raster resolution, 0..1. */
  height: Float32Array;
  rasterW: number;
  rasterH: number;
  stitchCount: number;
  borderColor: string | null;
  /** Share of each palette entry's area that is sewn raised (0..1). */
  raisedShare: number[];
  timings: Record<string, number>;
}
