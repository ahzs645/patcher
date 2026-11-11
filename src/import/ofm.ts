// Melco DesignShop / Bernina-Melco ".ofm" outline files → SVG.
//
// An .ofm is an OLE compound file. Its directory only lists three streams
// (Design Status, Design Icon and "EdsIV Object", the legacy EDS IV MFC
// archive, which in DesignShop 9+ files holds nothing but expanded stitches).
// The real design rides along in sectors the OLE directory never mentions: a
// RIFF form of type "OFM8" with chunks
//
//   vrsn  UTF-16 version string ("9.00")
//   thmb  PNG thumbnail
//   proj  u32 inflated size, u32 checksum, then a zlib stream of UTF-8 XML
//   exp   Melco EXP stitches, clri colour info, st32 status, LIST amya job …
//
// The XML <ObjectList> holds the editable objects, in sew order:
//
//   CmplxFill    fill: <FillOutlines><Outline><MainPointList> (outer + holes)
//   Column1      satin column: <FirstPointList> and <SecondPointList> rails
//   Walk         running stitch: <MainPointList>
//   Lettering    <LetterList><Letter> each with <VectorOutlineList> glyph fills
//   ExpandedObj  stitches only: <StitchList> "F<flag> x y x y …"
//   function.*   trims, colour changes, return to origin (no geometry)
//
// Point lists are PostScript-like: "x y m", "x y L", "x1 y1 x2 y2 x y c|C"
// (cubic Bézier; C marks a smooth node) and "cp" (close path). Units are
// 0.1 mm with Y pointing up.
//
// Pure TypeScript with no DOM use, so it runs in the browser, a worker or Node.

import { unzlibSync } from 'fflate';

export interface OfmThread {
  rgb: string;
  name: string;
  code: string;
  chart: string;
}

export type OfmShapeKind = 'fill' | 'column' | 'walk' | 'lettering' | 'stitches';

export interface OfmShape {
  kind: OfmShapeKind;
  /** Source object tag, e.g. CmplxFill. */
  object: string;
  /** SVG path data in design units (0.1 mm), Y already flipped to point down. */
  d: string;
  thread: OfmThread;
  /** Lettering text, when kind === 'lettering'. */
  text?: string;
  /** Title of the merged design this object belongs to. */
  design?: string;
}

export interface OfmDesign {
  version: string;
  title: string;
  shapes: OfmShape[];
  /** Bounds in design units, Y down: [minX, minY, maxX, maxY]. */
  bounds: [number, number, number, number];
  /** PNG thumbnail embedded by DesignShop, if any. */
  thumbnail: Uint8Array | null;
  /** Object counts by source tag, including objects with no geometry. */
  objects: Record<string, number>;
  /** The project XML, for anything this reader doesn't interpret. */
  xml: string;
}

// ---------------------------------------------------------------- container

function u32(b: Uint8Array, o: number): number {
  return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
}

function ascii(b: Uint8Array, o: number, n: number): string {
  return String.fromCharCode(...b.subarray(o, o + n));
}

/** Locate the RIFF "OFM8" form and return its chunks by id. */
export function ofmChunks(bytes: Uint8Array): Map<string, Uint8Array> {
  for (let i = 0; i + 12 <= bytes.length; i++) {
    // 'R' 'I' 'F' 'F' .... 'O' 'F' 'M' '8'
    if (bytes[i] !== 0x52 || bytes[i + 1] !== 0x49 || bytes[i + 2] !== 0x46 || bytes[i + 3] !== 0x46) continue;
    if (ascii(bytes, i + 8, 4) !== 'OFM8') continue;
    const end = Math.min(bytes.length, i + 8 + u32(bytes, i + 4));
    const chunks = new Map<string, Uint8Array>();
    let o = i + 12;
    while (o + 8 <= end) {
      const id = ascii(bytes, o, 4);
      const size = u32(bytes, o + 4);
      if (!chunks.has(id)) chunks.set(id, bytes.subarray(o + 8, Math.min(end, o + 8 + size)));
      o += 8 + size; // DesignShop does not pad odd-sized chunks
    }
    return chunks;
  }
  const ole = bytes.length > 8 && u32(bytes, 0) === 0xe011cfd0 && u32(bytes, 4) === 0xe11ab1a1;
  throw new Error(ole
    ? 'This .ofm has no DesignShop 9 project data (only a legacy EDS IV stream), so there are no outlines to read.'
    : 'Not a Melco .ofm file.');
}

// ---------------------------------------------------------------- tiny XML

interface XNode {
  tag: string;
  attrs: Record<string, string>;
  children: XNode[];
  text: string;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const unescape = (s: string) => s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e: string) =>
  e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENTITIES[e] ?? m);

function parseXml(src: string): XNode {
  const root: XNode = { tag: '#root', attrs: {}, children: [], text: '' };
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[([\s\S]*?)\]\]>|<(\/?)([\w.:-]+)((?:\s+[\w.:-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const top = stack[stack.length - 1];
    if (m[6] !== undefined) { top.text += unescape(m[6]); continue; }
    if (m[1] !== undefined) { top.text += m[1]; continue; }
    if (!m[3]) continue; // comment / declaration
    if (m[2]) { if (stack.length > 1) stack.pop(); continue; }
    const node: XNode = { tag: m[3], attrs: {}, children: [], text: '' };
    for (const a of m[4].matchAll(/([\w.:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) node.attrs[a[1]] = unescape(a[2] ?? a[3]);
    top.children.push(node);
    if (!m[5]) stack.push(node);
  }
  return root;
}

const child = (n: XNode | undefined, tag: string) => n?.children.find((c) => c.tag === tag);
const children = (n: XNode | undefined, tag: string) => n?.children.filter((c) => c.tag === tag) ?? [];
const textOf = (n: XNode | undefined) => n?.text.trim() ?? '';

// ---------------------------------------------------------------- geometry

type Pt = [number, number];
interface Seg { c1?: Pt; c2?: Pt; p: Pt }
interface Sub { start: Pt; segs: Seg[]; closed: boolean }

/** Parse a DesignShop point list into subpaths (Y flipped to point down). */
function parsePoints(src: string): Sub[] {
  const subs: Sub[] = [];
  let nums: number[] = [];
  let cur: Sub | null = null;
  const pt = (i: number): Pt => [nums[i], -nums[i + 1]];
  for (const tok of src.split(/\s+/)) {
    if (!tok) continue;
    const n = Number(tok);
    if (Number.isFinite(n) && /^[-+.\d]/.test(tok)) { nums.push(n); continue; }
    switch (tok) {
      case 'm':
        if (nums.length >= 2) { cur = { start: pt(nums.length - 2), segs: [], closed: false }; subs.push(cur); }
        break;
      case 'L': case 'l':
        if (nums.length >= 2) {
          if (!cur) { cur = { start: pt(nums.length - 2), segs: [], closed: false }; subs.push(cur); }
          else cur.segs.push({ p: pt(nums.length - 2) });
        }
        break;
      case 'c': case 'C':
        if (nums.length >= 6 && cur) cur.segs.push({ c1: pt(nums.length - 6), c2: pt(nums.length - 4), p: pt(nums.length - 2) });
        break;
      case 'cp': case 'h': case 'z':
        if (cur) cur.closed = true;
        break;
      default: break; // unknown operator: drop its operands
    }
    nums = [];
  }
  return subs;
}

function transformSubs(subs: Sub[], f: (p: Pt) => Pt): Sub[] {
  return subs.map((s) => ({
    start: f(s.start),
    closed: s.closed,
    segs: s.segs.map((g) => ({ c1: g.c1 && f(g.c1), c2: g.c2 && f(g.c2), p: f(g.p) })),
  }));
}

const fmt = (n: number) => String(Math.round(n * 1000) / 1000);
const P = (p: Pt) => `${fmt(p[0])} ${fmt(p[1])}`;

function subToD(s: Sub, close: boolean): string {
  let d = `M${P(s.start)}`;
  for (const g of s.segs) d += g.c1 && g.c2 ? `C${P(g.c1)} ${P(g.c2)} ${P(g.p)}` : `L${P(g.p)}`;
  return close || s.closed ? d + 'Z' : d;
}

function lastPoint(s: Sub): Pt {
  return s.segs.length ? s.segs[s.segs.length - 1].p : s.start;
}

/** Path segments of `s` walked backwards, starting from its last point. */
function reversedSegs(s: Sub): Seg[] {
  const out: Seg[] = [];
  for (let i = s.segs.length - 1; i >= 0; i--) {
    const g = s.segs[i];
    const to = i > 0 ? s.segs[i - 1].p : s.start;
    out.push(g.c1 && g.c2 ? { c1: g.c2, c2: g.c1, p: to } : { p: to });
  }
  return out;
}

/** A satin column's area: first rail forwards, second rail backwards. */
function columnD(first: Sub[], second: Sub[]): string {
  const a = first[0];
  const b = second[0];
  if (!a || !b) return '';
  const ring: Sub = { start: a.start, segs: [...a.segs, { p: lastPoint(b) }, ...reversedSegs(b)], closed: true };
  return subToD(ring, true);
}

function extend(bounds: number[], subs: Sub[]) {
  const add = (p?: Pt) => {
    if (!p) return;
    if (p[0] < bounds[0]) bounds[0] = p[0];
    if (p[1] < bounds[1]) bounds[1] = p[1];
    if (p[0] > bounds[2]) bounds[2] = p[0];
    if (p[1] > bounds[3]) bounds[3] = p[1];
  };
  for (const s of subs) { add(s.start); for (const g of s.segs) { add(g.c1); add(g.c2); add(g.p); } }
}

/** "F0 x y x y F4 x y …" → polylines of sewn stitches (jumps start new runs). */
function stitchSubs(src: string): Sub[] {
  const subs: Sub[] = [];
  let flag = 0;
  let nums: number[] = [];
  let cur: Sub | null = null;
  const flush = () => {
    for (let i = 0; i + 1 < nums.length; i += 2) {
      const p: Pt = [nums[i], -nums[i + 1]];
      if (flag !== 0) { cur = null; continue; } // jump / trim / colour change: no thread laid
      if (!cur) { cur = { start: p, segs: [], closed: false }; subs.push(cur); } else cur.segs.push({ p });
    }
    nums = [];
  };
  for (const tok of src.split(/\s+/)) {
    if (!tok) continue;
    if (/^F[0-9a-f]+$/i.test(tok)) {
      flush();
      const next = parseInt(tok.slice(1), 16);
      // the first point after a jump is where sewing resumes
      if (flag !== 0 && next === 0) cur = null;
      flag = next;
      continue;
    }
    const n = Number(tok);
    if (Number.isFinite(n)) nums.push(n);
  }
  flush();
  return subs.filter((s) => s.segs.length > 0);
}

// ---------------------------------------------------------------- threads

function rgbOf(v: string): string {
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase();
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return '#000000';
  // Windows COLORREF: 0x00BBGGRR
  const r = n & 0xff, g = (n >> 8) & 0xff, b = (n >> 16) & 0xff;
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

function threadOf(obj: XNode, fallback: OfmThread): OfmThread {
  const c = child(child(obj, 'Style'), 'color');
  const rgb = textOf(child(c, 'RGB'));
  if (!rgb) return fallback;
  return { rgb: rgbOf(rgb), name: textOf(child(c, 'name')), code: textOf(child(c, 'code')), chart: textOf(child(c, 'type')) };
}

// ---------------------------------------------------------------- reader

function decodeVersion(b: Uint8Array | undefined): string {
  if (!b) return '';
  let s = '';
  for (let i = 0; i + 1 < b.length; i += 2) { const c = b[i] | (b[i + 1] << 8); if (c) s += String.fromCharCode(c); }
  return s;
}

/** Read an .ofm file's vector objects. */
export function readOfm(bytes: Uint8Array | ArrayBuffer): OfmDesign {
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const chunks = ofmChunks(buf);
  const proj = chunks.get('proj');
  if (!proj || proj.length < 10) throw new Error('This .ofm has no project chunk.');
  let xml: string;
  try {
    xml = new TextDecoder('utf-8').decode(unzlibSync(proj.subarray(8)));
  } catch {
    throw new Error('This .ofm project data is damaged (it could not be decompressed).');
  }
  const root = parseXml(xml.replace(/^﻿/, ''));
  const project = child(root, 'Project') ?? root;

  const shapes: OfmShape[] = [];
  const objects: Record<string, number> = {};
  const bounds = [Infinity, Infinity, -Infinity, -Infinity];
  let thread: OfmThread = { rgb: '#000000', name: '', code: '', chart: '' };

  const emit = (kind: OfmShapeKind, obj: XNode, subs: Sub[], d: string, extra?: Partial<OfmShape>) => {
    if (!d) return;
    extend(bounds, subs);
    shapes.push({ kind, object: obj.tag, d, thread: threadOf(obj, thread), ...extra });
  };

  const fillD = (subs: Sub[]) => subs.map((s) => subToD(s, true)).join('');
  const fillSubs = (obj: XNode) =>
    children(child(obj, 'FillOutlines'), 'Outline').flatMap((o) => parsePoints(textOf(child(o, 'MainPointList'))));

  const visit = (obj: XNode, design: string) => {
    switch (obj.tag) {
      case 'CmplxFill': {
        const subs = fillSubs(obj);
        emit('fill', obj, subs, fillD(subs), { design });
        break;
      }
      case 'Column1': {
        const a = parsePoints(textOf(child(obj, 'FirstPointList')));
        const b = parsePoints(textOf(child(obj, 'SecondPointList')));
        emit('column', obj, [...a, ...b], columnD(a, b), { design });
        break;
      }
      case 'Walk': {
        const subs = parsePoints(textOf(child(obj, 'MainPointList')));
        emit('walk', obj, subs, subs.map((s) => subToD(s, false)).join(''), { design });
        break;
      }
      case 'ExpandedObj': {
        const subs = stitchSubs(textOf(child(obj, 'StitchList')));
        emit('stitches', obj, subs, subs.map((s) => subToD(s, false)).join(''), { design });
        break;
      }
      case 'Lettering': {
        const text = textOf(findDeep(child(obj, 'Style'), 'TextString'));
        for (const letter of children(child(obj, 'LetterList'), 'Letter')) {
          // Letter outlines are in the letter's own space; the affine places it.
          const m = textOf(child(letter, 'AffineTransformation')).split(/\s+/).map(Number);
          const tf = m.length === 6 && m.every(Number.isFinite)
            ? (subs: Sub[]) => transformSubs(subs, (p) => applyAffine(m, p))
            : (subs: Sub[]) => subs;
          const data = child(letter, 'OutlineData');
          const glyph = child(data, 'VectorOutlineList')?.children.filter((c) => c.tag === 'CmplxFill') ?? [];
          // Glyph fills are the letter's true shape; fall back to its stitch objects.
          const parts = glyph.length ? glyph : child(data, 'OutlineList')?.children ?? [];
          const subs: Sub[] = [];
          let d = '';
          for (const p of parts) {
            if (p.tag === 'CmplxFill') {
              const s = tf(fillSubs(p));
              subs.push(...s); d += fillD(s);
            } else if (p.tag === 'Column1') {
              const a = tf(parsePoints(textOf(child(p, 'FirstPointList'))));
              const b = tf(parsePoints(textOf(child(p, 'SecondPointList'))));
              subs.push(...a, ...b); d += columnD(a, b);
            }
          }
          const styled = letter.children.some((c) => c.tag === 'Style') ? letter : obj;
          emit('lettering', styled, subs, d, { object: 'Lettering', text: text || textOf(child(letter, 'Character')), design });
        }
        break;
      }
      default:
        break;
    }
  };

  // A project's DesignList holds one Group per merged design, each with its own
  // ObjectList in absolute coordinates; older files have a bare ObjectList.
  const groups = children(child(project, 'DesignList'), 'Group');
  const lists: [XNode, string][] = groups.length
    ? groups.flatMap((g) => { const l = child(g, 'ObjectList'); return l ? [[l, textOf(child(g, 'Title'))] as [XNode, string]] : []; })
    : [];
  if (!lists.length) {
    const l = findDeep(child(project, 'DesignList') ?? project, 'ObjectList');
    if (l) lists.push([l, '']);
  }
  if (!lists.length) throw new Error('This .ofm has no object list.');

  for (const [list, design] of lists) {
    for (const obj of list.children) {
      objects[obj.tag] = (objects[obj.tag] ?? 0) + 1;
      visit(obj, design);
      const last = shapes[shapes.length - 1];
      if (last) thread = last.thread;
    }
  }

  if (!shapes.length) throw new Error('This .ofm has no outlines or stitches to draw.');
  return {
    version: decodeVersion(chunks.get('vrsn')),
    title: lists.map(([, t]) => t).filter((t) => t && t !== 'Design').join(' + '),
    shapes,
    bounds: bounds as [number, number, number, number],
    thumbnail: chunks.get('thmb')?.slice() ?? null,
    objects,
    xml,
  };
}

function findDeep(n: XNode | undefined, tag: string): XNode | undefined {
  if (!n) return undefined;
  for (const c of n.children) {
    if (c.tag === tag) return c;
    const f = findDeep(c, tag);
    if (f) return f;
  }
  return undefined;
}

function applyAffine(m: number[], p: Pt): Pt {
  // Points are already Y-flipped; flip back, transform, flip again.
  const x = p[0], y = -p[1];
  return [m[0] * x + m[1] * y + m[2], -(m[3] * x + m[4] * y + m[5])];
}

// ---------------------------------------------------------------- SVG

export interface OfmSvgOptions {
  /** Margin around the design, in mm. Default 2. */
  marginMm?: number;
  /** Stroke width for running-stitch walks and expanded stitches, in mm. Default 0.5. */
  walkWidthMm?: number;
  /** Leave walks (running stitch outlines and travel runs) out. Default false. */
  omitWalks?: boolean;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Convert a design to a standalone SVG, sized in millimetres, one group per object in sew order. */
export function ofmToSvg(design: OfmDesign, opts: OfmSvgOptions = {}): string {
  const margin = (opts.marginMm ?? 2) * 10;
  const walk = (opts.walkWidthMm ?? 0.5) * 10;
  const [x0, y0, x1, y1] = design.bounds;
  const vx = x0 - margin, vy = y0 - margin;
  const vw = x1 - x0 + 2 * margin, vh = y1 - y0 + 2 * margin;
  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(vw / 10)}mm" height="${fmt(vh / 10)}mm" viewBox="${fmt(vx)} ${fmt(vy)} ${fmt(vw)} ${fmt(vh)}">`);
  if (design.title) out.push(`<title>${esc(design.title)}</title>`);
  out.push(`<desc>Converted from Melco DesignShop .ofm${design.version ? ` v${esc(design.version)}` : ''}; units 0.1 mm; one element per object in sew order.</desc>`);
  const multi = new Set(design.shapes.map((s) => s.design ?? '')).size > 1;
  let group: string | undefined;
  design.shapes.forEach((s, i) => {
    if (opts.omitWalks && s.kind === 'walk') return;
    if (multi && s.design !== group) {
      if (group !== undefined) out.push('</g>');
      group = s.design ?? '';
      out.push(`<g data-design="${esc(group)}">`);
    }
    const t = s.thread;
    const label = [t.chart, t.code, t.name].filter(Boolean).join(' ');
    const common = `id="o${i + 1}" data-kind="${s.kind}" data-object="${esc(s.object)}" data-thread="${esc(label)}"${s.text ? ` data-text="${esc(s.text)}"` : ''}`;
    if (s.kind === 'walk' || s.kind === 'stitches') {
      out.push(`<path ${common} d="${s.d}" fill="none" stroke="${t.rgb}" stroke-width="${fmt(walk)}" stroke-linecap="round" stroke-linejoin="round"/>`);
    } else {
      out.push(`<path ${common} d="${s.d}" fill="${t.rgb}" fill-rule="evenodd"/>`);
    }
  });
  if (group !== undefined) out.push('</g>');
  out.push('</svg>');
  return out.join('\n');
}

/** True for bytes that look like an .ofm (OLE file carrying a RIFF OFM8 form). */
export function isOfm(bytes: Uint8Array): boolean {
  try { ofmChunks(bytes); return true; } catch { return false; }
}
