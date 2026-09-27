// Tajima DST writer (encoding follows pyembroidery's DstWriter): 512-byte
// header, then 3-byte records of relative moves in 0.1 mm, |dx|,|dy| <= 121.

import type { DigitizeResult } from '../types';
import { machineStats, machineStitches, relative } from './machine';

const MAX = 121;

function bit(b: number) { return 1 << b; }

function encode(dx: number, dy: number, kind: 'stitch' | 'jump' | 'color' | 'end'): number[] {
  if (kind === 'color') return [0, 0, 0b11000011];
  if (kind === 'end') return [0, 0, 0b11110011];
  let x = dx, y = -dy; // DST y axis points up
  let b0 = 0, b1 = 0, b2 = bit(0) | bit(1);
  if (kind === 'jump') b2 |= bit(7);
  if (x > 40) { b2 |= bit(2); x -= 81; }
  if (x < -40) { b2 |= bit(3); x += 81; }
  if (x > 13) { b1 |= bit(2); x -= 27; }
  if (x < -13) { b1 |= bit(3); x += 27; }
  if (x > 4) { b0 |= bit(2); x -= 9; }
  if (x < -4) { b0 |= bit(3); x += 9; }
  if (x > 1) { b1 |= bit(0); x -= 3; }
  if (x < -1) { b1 |= bit(1); x += 3; }
  if (x > 0) { b0 |= bit(0); x -= 1; }
  if (x < 0) { b0 |= bit(1); x += 1; }
  if (y > 40) { b2 |= bit(5); y -= 81; }
  if (y < -40) { b2 |= bit(4); y += 81; }
  if (y > 13) { b1 |= bit(5); y -= 27; }
  if (y < -13) { b1 |= bit(4); y += 27; }
  if (y > 4) { b0 |= bit(5); y -= 9; }
  if (y < -4) { b0 |= bit(4); y += 9; }
  if (y > 1) { b1 |= bit(7); y -= 3; }
  if (y < -1) { b1 |= bit(6); y += 3; }
  if (y > 0) { b0 |= bit(7); y -= 1; }
  if (y < 0) { b0 |= bit(6); y += 1; }
  return [b0, b1, b2];
}

export function writeDst(result: DigitizeResult, name: string): Uint8Array<ArrayBuffer> {
  const records: number[] = [];
  const seq = machineStitches(result);
  const stats = machineStats(seq);
  let px = 0, py = 0, count = 0;
  let minX = 0, maxX = 0, minY = 0, maxY = 0;
  relative(seq, MAX, (dx, dy, cmd) => {
    if (cmd === 'trim') {
      // DST has no trim record: three tiny jumps are read as one by most machines.
      records.push(...encode(2, 2, 'jump'), ...encode(-4, -4, 'jump'), ...encode(2, 2, 'jump'));
      count += 3;
      return;
    }
    if (cmd === 'color' || cmd === 'end') { records.push(...encode(0, 0, cmd)); return; }
    records.push(...encode(dx, dy, cmd));
    count++;
    px += dx; py += dy;
    minX = Math.min(minX, px); maxX = Math.max(maxX, px);
    minY = Math.min(minY, py); maxY = Math.max(maxY, py);
  });

  const header = new Uint8Array(512).fill(0x20);
  const fields = [
    `LA:${name.slice(0, 16).padEnd(16, ' ')}\r`,
    `ST:${String(count).padStart(7, ' ')}\r`,
    `CO:${String(stats.colorChanges).padStart(3, ' ')}\r`,
    `+X:${String(maxX).padStart(5, ' ')}\r`,
    `-X:${String(-minX).padStart(5, ' ')}\r`,
    `+Y:${String(-minY).padStart(5, ' ')}\r`,
    `-Y:${String(maxY).padStart(5, ' ')}\r`,
    `AX:+${String(Math.abs(px)).padStart(5, ' ')}\r`,
    `AY:+${String(Math.abs(py)).padStart(5, ' ')}\r`,
    `MX:+${'0'.padStart(5, ' ')}\r`,
    `MY:+${'0'.padStart(5, ' ')}\r`,
    `PD:${'******'}\r`,
  ].join('');
  for (let i = 0; i < fields.length; i++) header[i] = fields.charCodeAt(i) & 0x7f;
  header[fields.length] = 0x1a;

  const out = new Uint8Array(512 + records.length);
  out.set(header, 0);
  out.set(records, 512);
  return out;
}
