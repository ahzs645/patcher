// Melco / Bernina EXP writer (format as in pystitch's ExpWriter, via bastidor):
// 2-byte signed relative moves in 0.1 mm (y up), 0x80-prefixed control records.

import type { DigitizeResult } from '../types';
import { machineStitches, relative } from './machine';

export function writeExp(result: DigitizeResult): Uint8Array<ArrayBuffer> {
  const bytes: number[] = [];
  const s8 = (v: number) => (v < 0 ? v + 256 : v) & 0xff;
  relative(machineStitches(result), 127, (dx, dy, cmd) => {
    if (cmd === 'stitch') bytes.push(s8(dx), s8(-dy));
    else if (cmd === 'jump') bytes.push(0x80, 0x04, s8(dx), s8(-dy));
    else if (cmd === 'trim') bytes.push(0x80, 0x80, 0x07, 0x00);
    else if (cmd === 'color') bytes.push(0x80, 0x01, 0x00, 0x00);
  });
  return Uint8Array.from(bytes);
}
