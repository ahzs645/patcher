// Patch profiles: what a source photograph shows about how one patch was made, that its drawing
// cannot say. Which colour is the cloth, the colour of the edge, the thread a drawn colour really
// is, the direction an area is sewn in.
//
// They live in library/profiles.json, written by hand like orgs.json, and are applied on top of the
// automatic digitizing. The drawings themselves stay as the atlas made them (they are checked byte
// for byte), so a colour correction here changes the thread, not the SVG. Colours are matched to
// the nearest detected thread, since those shift a little with the size the art is sewn at.

import raw from '../library/profiles.json';
import { nearestIndex } from './digitize/quantize';
import type { DigitizeParams } from './types';

export interface PatchProfile {
  /** What the settings are read from: the photograph or scan, and what it shows. */
  evidence: string;
  /** Digitizing settings for this patch (ground colour, edge colour and width, fill angles, ...). */
  params?: Partial<DigitizeParams>;
  /** Thread colour corrections: the drawing's colour → the thread seen in the source. */
  threads?: Record<string, string>;
}

export const PROFILES = raw as Record<string, PatchProfile>;

export const profileOf = (id: string): PatchProfile | null => PROFILES[id] ?? null;

/** The profile's digitizing settings, to spread under the caller's own. */
export const profileParams = (id: string): Partial<DigitizeParams> => PROFILES[id]?.params ?? {};

/** One colour as the profile says it is sewn. */
export function threadColor(profile: PatchProfile | null, hex: string | null): string | null {
  if (!hex || !profile?.threads) return hex;
  const from = Object.keys(profile.threads);
  const i = nearestIndex(from, hex);
  return i >= 0 ? profile.threads[from[i]] : hex;
}

/** A detected palette as the profile says it is sewn, for renderTextured's `colors`. */
export const threadColors = (profile: PatchProfile | null, palette: string[]): string[] =>
  palette.map((hex) => threadColor(profile, hex) ?? hex);
