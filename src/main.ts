import './style.css';
import { DEFAULT_PARAMS, type DigitizeParams, type DigitizeResult } from './types';
import { loadSvg, rasterize, type LoadedSvg } from './svg';
import { renderTextured, type Finish } from './render/textured';
import { renderPlan } from './render/plan';
import { writeDst } from './export/dst';
import { writeExp } from './export/exp';
import { machineStats, machineStitches } from './export/machine';
import { buildPatchSvg } from './patchSvg';
import { nearestThread } from './threadCharts';

/** Transparent margin around the art for the merrow lip and shadows. */
const PAD_MM = 4;
/** CSS px per mm at zoom 1 — every pane shares this so they line up. */
const BASE = 5;
const STORE_KEY = 'patcher:v1';
const SAMPLES = [
  { file: 'city-police.svg', label: 'City police shield' },
  { file: 'state-trooper.svg', label: 'State trooper seal' },
  { file: 'k9-unit.svg', label: 'K-9 unit' },
  { file: 'harbor-patrol.svg', label: 'Harbor patrol' },
];
/** Garment backdrops — the patch shown on the fabric it will be sewn to. */
const BACKDROPS: { id: string; label: string; color?: string }[] = [
  { id: 'studio', label: 'Studio' },
  { id: 'navy', label: 'Navy uniform', color: '#1d2a44' },
  { id: 'black', label: 'Tactical black', color: '#1e1f22' },
  { id: 'khaki', label: 'Khaki', color: '#b59f78' },
  { id: 'olive', label: 'Olive drab', color: '#4f5534' },
  { id: 'light', label: 'Light blue shirt', color: '#aebfd6' },
];

type View = 'compare' | 'split' | 'svg' | 'stitched' | 'plan';
const isMobile = () => window.matchMedia('(max-width: 860px)').matches;
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const state = {
  svg: null as LoadedSvg | null,
  name: 'patch',
  source: '',
  params: { ...DEFAULT_PARAMS } as DigitizeParams,
  result: null as DigitizeResult | null,
  /** Thread colour overrides keyed by the detected colour. */
  overrides: {} as Record<string, string>,
  view: (isMobile() ? 'compare' : 'split') as View,
  lightDeg: 225,
  finish: 'matte' as Finish,
  backdrop: 'studio',
  chart: 'Brother',
  snap: false,
  zoom: { k: 1, x: 0, y: 0 },
  wipe: 0.5,
  /** null = fully sewn; otherwise the number of needle points shown. */
  simLimit: null as number | null,
  patchSvgUrl: '',
};

// ---------------------------------------------------------------- persistence (per-viewer convenience)

function loadPrefs() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const p = JSON.parse(raw);
    Object.assign(state.params, p.params ?? {});
    for (const k of ['view', 'lightDeg', 'finish', 'backdrop', 'chart', 'snap', 'source'] as const) {
      if (p[k] !== undefined) (state as Record<string, unknown>)[k] = p[k];
    }
  } catch { /* storage unavailable — defaults are fine */ }
}
let saveTimer = 0;
function savePrefs() {
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      const { params, view, lightDeg, finish, backdrop, chart, snap, source } = state;
      localStorage.setItem(STORE_KEY, JSON.stringify({ params, view, lightDeg, finish, backdrop, chart, snap, source }));
    } catch { /* ignore */ }
  }, 300);
}

// ---------------------------------------------------------------- worker

const worker = new Worker(new URL('./digitize/worker.ts', import.meta.url), { type: 'module' });
let jobId = 0;
const pending = new Map<number, (r: { result?: DigitizeResult; error?: string }) => void>();
worker.onmessage = (e) => {
  const cb = pending.get(e.data.id);
  pending.delete(e.data.id);
  cb?.(e.data);
};

let digitizeTimer = 0;
function scheduleDigitize(delay = 200) {
  clearTimeout(digitizeTimer);
  digitizeTimer = window.setTimeout(runDigitize, delay);
  savePrefs();
}

async function runDigitize() {
  if (!state.svg) return;
  const id = ++jobId;
  setBusy('Digitizing…');
  showError(null);
  try {
    const raster = await rasterize(state.svg, state.params.widthMm, state.params.pxPerMm, PAD_MM);
    if (id !== jobId) return;
    const msg = await new Promise<{ result?: DigitizeResult; error?: string }>((resolve) => {
      pending.set(id, resolve);
      worker.postMessage({ id, raster, params: state.params }, [raster.data.buffer]);
    });
    if (id !== jobId) return;
    if (msg.error || !msg.result) throw new Error(msg.error || 'Digitizing failed');
    state.result = msg.result;
    stopPlay();
    state.simLimit = null;
    setBusy('Rendering…');
    await nextFrame();
    renderAll();
    updatePalette();
    updateDetails();
    updateSim();
  } catch (err) {
    console.error(err);
    showError((err as Error).message.split('\n')[0]);
  } finally {
    if (id === jobId) setBusy(null);
  }
}

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r(null)));

// ---------------------------------------------------------------- colours

function threadColor(detected: string): string {
  if (state.overrides[detected]) return state.overrides[detected];
  if (state.snap) return nearestThread(detected, state.chart)?.[0] ?? detected;
  return detected;
}
function colors(): string[] {
  return state.result ? state.result.palette.map(threadColor) : [];
}
function borderColor(): string | null {
  const r = state.result;
  if (!r || state.params.border === 'none') return null;
  if (state.params.borderColor) return state.params.borderColor;
  return r.borderColor ? threadColor(r.borderColor) : null;
}

// ---------------------------------------------------------------- rendering

function renderScale(r: DigitizeResult) {
  return (Math.min(16, 3200 / Math.max(r.widthMm, r.heightMm)) * Math.min(2, window.devicePixelRatio || 1)) / 1.4;
}

/** fast = lower resolution, used while scrubbing / playing the sew-out. */
function renderStitched(fast = false) {
  const r = state.result;
  if (!r) return;
  const c = $<HTMLCanvasElement>('stitched');
  renderTextured(r, {
    scale: fast ? Math.min(7, renderScale(r)) : renderScale(r),
    lightDeg: state.lightDeg,
    colors: colors(),
    borderColor: borderColor(),
    limit: state.simLimit ?? undefined,
    dropShadow: true,
    finish: state.finish,
  }, c);
  // The compare view shows the same pixels.
  const cmp = $<HTMLCanvasElement>('cmpCanvas');
  cmp.width = c.width;
  cmp.height = c.height;
  cmp.getContext('2d')!.drawImage(c, 0, 0);
}

function renderPlanView(fast = false) {
  const r = state.result;
  if (!r) return;
  renderPlan(r, {
    scale: fast ? Math.min(7, renderScale(r)) : renderScale(r),
    colors: colors(), borderColor: borderColor(), showJumps: true, limit: state.simLimit ?? undefined,
  }, $<HTMLCanvasElement>('plan'));
}

function renderAll() {
  if (!state.result) return;
  renderStitched();
  renderPlanView();
  updatePatchSvg();
  layoutStages();
  updateDoc();
}

function updatePatchSvg() {
  if (!state.svg) return;
  const text = buildPatchSvg(state.svg, state.params, state.result, borderColor(), PAD_MM);
  if (state.patchSvgUrl) URL.revokeObjectURL(state.patchSvgUrl);
  state.patchSvgUrl = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
  $<HTMLImageElement>('svgImg').src = state.patchSvgUrl;
  $<HTMLImageElement>('cmpImg').src = state.patchSvgUrl;
}

let recolorRaf = 0;
function scheduleRecolor() {
  cancelAnimationFrame(recolorRaf);
  recolorRaf = requestAnimationFrame(() => {
    renderStitched();
    renderPlanView();
    updatePatchSvg();
    updateDetails();
  });
  savePrefs();
}

// ---------------------------------------------------------------- stage layout, pan / zoom / pinch

/** Design size in mm (art + padding), known before digitizing finishes. */
function designMm(): [number, number] {
  const aspect = state.svg?.aspect ?? 1;
  return [state.params.widthMm + PAD_MM * 2, state.params.widthMm * aspect + PAD_MM * 2];
}

function layoutStages() {
  const [wmm, hmm] = designMm();
  document.querySelectorAll<HTMLElement>('.stage').forEach((s) => {
    s.style.width = `${wmm * BASE}px`;
    s.style.height = `${hmm * BASE}px`;
  });
  applyZoom();
}

function visiblePane(): HTMLElement | null {
  return Array.from(document.querySelectorAll<HTMLElement>('.pane')).find((p) => p.offsetParent) ?? null;
}

function fit() {
  const pane = visiblePane();
  if (!pane || !pane.clientWidth) return;
  const [wmm, hmm] = designMm();
  const k = Math.min(pane.clientWidth / (wmm * BASE), pane.clientHeight / (hmm * BASE)) * 0.9;
  state.zoom = { k, x: (pane.clientWidth - wmm * BASE * k) / 2, y: (pane.clientHeight - hmm * BASE * k) / 2 };
  applyZoom();
}

function applyZoom() {
  const { k, x, y } = state.zoom;
  document.querySelectorAll<HTMLElement>('.stage').forEach((s) => {
    s.style.transform = `translate(${x}px, ${y}px) scale(${k})`;
  });
  updateWipe();
}

function zoomAt(px: number, py: number, factor: number) {
  const z = state.zoom;
  const k = Math.max(0.1, Math.min(40, z.k * factor));
  const f = k / z.k;
  state.zoom = { k, x: px - (px - z.x) * f, y: py - (py - z.y) * f };
  applyZoom();
}

function setupPanZoom() {
  document.querySelectorAll<HTMLElement>('.pane').forEach((pane) => {
    pane.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = pane.getBoundingClientRect();
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
    }, { passive: false });

    // One pointer pans; two pointers pinch-zoom around their midpoint.
    const pts = new Map<number, { x: number; y: number }>();
    let last: { cx: number; cy: number; d: number } | null = null;
    const summary = () => {
      const v = [...pts.values()];
      const rect = pane.getBoundingClientRect();
      const cx = v.reduce((a, p) => a + p.x, 0) / v.length - rect.left;
      const cy = v.reduce((a, p) => a + p.y, 0) / v.length - rect.top;
      const d = v.length > 1 ? Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y) : 0;
      return { cx, cy, d };
    };
    pane.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('.wipe, .zoom, button')) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      pane.setPointerCapture(e.pointerId);
      pane.classList.add('dragging');
      last = summary();
    });
    pane.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId) || !last) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const now = summary();
      state.zoom.x += now.cx - last.cx;
      state.zoom.y += now.cy - last.cy;
      if (now.d && last.d) zoomAt(now.cx, now.cy, now.d / last.d);
      else applyZoom();
      last = now;
    });
    const end = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      last = pts.size ? summary() : null;
      if (!pts.size) pane.classList.remove('dragging');
    };
    pane.addEventListener('pointerup', end);
    pane.addEventListener('pointercancel', end);
    pane.addEventListener('dblclick', fit);
  });

  const center = (factor: number) => {
    const pane = visiblePane();
    if (pane) zoomAt(pane.clientWidth / 2, pane.clientHeight / 2, factor);
  };
  $('zoomIn').onclick = () => center(1.4);
  $('zoomOut').onclick = () => center(1 / 1.4);
  $('zoomFit').onclick = fit;
  new ResizeObserver(() => fit()).observe($('panes'));
}

// ---------------------------------------------------------------- compare wipe

function updateWipe() {
  const pane = document.querySelector<HTMLElement>('[data-pane=compare]')!;
  const wipe = $('wipe');
  const px = pane.clientWidth * state.wipe;
  wipe.style.left = `${px}px`;
  wipe.setAttribute('aria-valuenow', String(Math.round(state.wipe * 100)));
  // Clip the embroidered layer to the right of the handle, in stage-local units.
  const [wmm] = designMm();
  const localX = (px - state.zoom.x) / state.zoom.k;
  const pct = Math.max(0, Math.min(100, (localX / (wmm * BASE)) * 100));
  $('cmpCanvas').style.clipPath = `inset(0 0 0 ${pct}%)`;
}

function setupWipe() {
  const wipe = $('wipe');
  const pane = wipe.parentElement!;
  const move = (clientX: number) => {
    const rect = pane.getBoundingClientRect();
    state.wipe = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    updateWipe();
  };
  wipe.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    wipe.setPointerCapture(e.pointerId);
    const mv = (ev: PointerEvent) => move(ev.clientX);
    const up = () => { wipe.removeEventListener('pointermove', mv); wipe.removeEventListener('pointerup', up); };
    wipe.addEventListener('pointermove', mv);
    wipe.addEventListener('pointerup', up);
  });
  wipe.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      state.wipe = Math.max(0, Math.min(1, state.wipe + (e.key === 'ArrowLeft' ? -0.05 : 0.05)));
      updateWipe();
      e.preventDefault();
    }
  });
}

// ---------------------------------------------------------------- sew-out simulator (bastidor-style scrubber)

let playRaf = 0;
function blockColorAt(limit: number): string | null {
  const r = state.result;
  if (!r) return null;
  let acc = 0;
  for (const b of r.blocks) {
    acc += b.points.length / 2;
    if (limit <= acc) return b.kind === 'border' ? borderColor() : colors()[b.paletteIndex] ?? b.color;
  }
  return null;
}

function updateSim() {
  const r = state.result;
  const scrub = $<HTMLInputElement>('scrub');
  if (!r) { $('simCount').textContent = '—'; $('simColor').style.background = 'transparent'; return; }
  const total = r.stitchCount;
  const cur = state.simLimit ?? total;
  scrub.max = String(total);
  scrub.value = String(cur);
  $('simCount').textContent = `${cur.toLocaleString()} / ${total.toLocaleString()}`;
  $('simColor').style.background = blockColorAt(Math.max(1, cur)) ?? 'transparent';
}

function simRender(fast: boolean) {
  if (state.view === 'plan') renderPlanView(fast);
  else renderStitched(fast);
}

function stopPlay() {
  if (!playRaf) return;
  cancelAnimationFrame(playRaf);
  playRaf = 0;
  $('playIcon').setAttribute('d', 'M7 5v14l12-7z');
}

function setupSim() {
  const scrub = $<HTMLInputElement>('scrub');
  let raf = 0;
  scrub.addEventListener('input', () => {
    stopPlay();
    const v = parseInt(scrub.value, 10);
    state.simLimit = v >= (state.result?.stitchCount ?? 0) ? null : v;
    updateSim();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => simRender(true));
  });
  scrub.addEventListener('change', () => simRender(false));

  $('play').onclick = () => {
    const r = state.result;
    if (!r) return;
    if (playRaf) { stopPlay(); simRender(false); return; }
    if (state.view === 'svg') setView('stitched');
    $('playIcon').setAttribute('d', 'M7 5h4v14H7zM13 5h4v14h-4z');
    const total = r.stitchCount;
    let pos = state.simLimit ?? 0;
    if (pos >= total) pos = 0;
    let prev = performance.now();
    const step = (now: number) => {
      const speed = parseFloat($<HTMLSelectElement>('simSpeed').value);
      // A full design takes ~8 s at 1×.
      pos += ((now - prev) / 1000) * (total / 8) * speed;
      prev = now;
      if (pos >= total) {
        state.simLimit = null;
        playRaf = 0;
        $('playIcon').setAttribute('d', 'M7 5v14l12-7z');
        updateSim();
        simRender(false);
        return;
      }
      state.simLimit = Math.floor(pos);
      updateSim();
      simRender(true);
      playRaf = requestAnimationFrame(step);
    };
    playRaf = requestAnimationFrame(step);
  };
}

// ---------------------------------------------------------------- controls

type NumKey = { [K in keyof DigitizeParams]: DigitizeParams[K] extends number ? K : never }[keyof DigitizeParams];

const FORMAT: Partial<Record<NumKey | 'lightDeg', (v: number) => string>> = {
  widthMm: (v) => `${v} mm · ${(v / 25.4).toFixed(2)}″`,
  maxColors: (v) => `${v}`,
  colorTolerance: (v) => `${v}`,
  fillSpacingMm: (v) => `${v.toFixed(2)} mm`,
  fillStitchMm: (v) => `${v.toFixed(1)} mm`,
  fillAngleDeg: (v) => `${v}°`,
  satinMaxWidthMm: (v) => (v === 0 ? 'off' : `${v.toFixed(1)} mm`),
  borderWidthMm: (v) => `${v.toFixed(1)} mm`,
  lightDeg: (v) => `${v}°`,
};
const RANGE_KEYS: NumKey[] = ['widthMm', 'maxColors', 'colorTolerance', 'fillSpacingMm', 'fillStitchMm', 'fillAngleDeg', 'satinMaxWidthMm', 'borderWidthMm'];

function syncControls() {
  for (const key of RANGE_KEYS) {
    $<HTMLInputElement>(key).value = String(state.params[key]);
    $(`${key}Out`).textContent = FORMAT[key]!(state.params[key]);
  }
  $<HTMLInputElement>('varyAngles').checked = state.params.varyAngles;
  $<HTMLInputElement>('underlay').checked = state.params.underlay;
  $<HTMLInputElement>('borderAuto').checked = !state.params.borderColor;
  $<HTMLInputElement>('borderColor').disabled = !state.params.borderColor;
  if (state.params.borderColor) $<HTMLInputElement>('borderColor').value = state.params.borderColor;
  $<HTMLInputElement>('lightDeg').value = String(state.lightDeg);
  $('lightDegOut').textContent = FORMAT.lightDeg!(state.lightDeg);
  $<HTMLInputElement>('snapChart').checked = state.snap;
  $<HTMLSelectElement>('chart').value = state.chart;
  document.querySelectorAll<HTMLElement>('[data-seg-sync]').forEach((el) => el.dispatchEvent(new Event('sync')));
  syncSizeChips();
}

function bindRange(key: NumKey) {
  const input = $<HTMLInputElement>(key);
  const out = $(`${key}Out`);
  input.addEventListener('input', () => {
    (state.params[key] as number) = parseFloat(input.value);
    out.textContent = FORMAT[key]!(state.params[key]);
    if (key === 'widthMm') { updateSizeInfo(); layoutStages(); fit(); syncSizeChips(); }
    scheduleDigitize(key === 'widthMm' ? 350 : 220);
  });
}

function bindSeg(id: string, get: () => string, set: (v: string) => void) {
  const el = $(id);
  el.dataset.segSync = '';
  const sync = () => el.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
    const on = b.dataset.v === get();
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
  });
  el.querySelectorAll<HTMLButtonElement>('button').forEach((b) => (b.onclick = () => { set(b.dataset.v!); sync(); }));
  el.addEventListener('sync', sync);
  sync();
}

function setView(v: View) {
  state.view = v;
  $('panes').dataset.view = v;
  $('view').dispatchEvent(new Event('sync'));
  requestAnimationFrame(fit);
  savePrefs();
}

function setTab(tab: string) {
  document.querySelectorAll<HTMLButtonElement>('#tabs button').forEach((b) => {
    b.classList.toggle('on', b.dataset.tab === tab);
    b.setAttribute('aria-selected', String(b.dataset.tab === tab));
  });
  document.querySelectorAll<HTMLElement>('.panel').forEach((p) => (p.hidden = p.dataset.panel !== tab));
}

function syncSizeChips() {
  document.querySelectorAll<HTMLButtonElement>('#sizePresets button').forEach((b) =>
    b.classList.toggle('on', Math.abs(parseFloat(b.dataset.w!) - state.params.widthMm) < 1));
}

function updateSizeInfo() {
  const [w, h] = [state.params.widthMm, state.params.widthMm * (state.svg?.aspect ?? 1)];
  $('sizeInfo').textContent = `Finished size ${w.toFixed(0)} × ${h.toFixed(0)} mm (${(w / 25.4).toFixed(2)} × ${(h / 25.4).toFixed(2)} in)`;
}

function updateDoc() {
  $('docName').textContent = state.name;
  const r = state.result;
  const [w, h] = [state.params.widthMm, state.params.widthMm * (state.svg?.aspect ?? 1)];
  $('docMeta').textContent = r
    ? `${w.toFixed(0)} × ${h.toFixed(0)} mm · ${(r.stitchCount / 1000).toFixed(1)}k stitches · ${r.palette.length} colors`
    : `${w.toFixed(0)} × ${h.toFixed(0)} mm`;
}

function updatePalette() {
  const r = state.result;
  const ul = $('palette');
  ul.innerHTML = '';
  if (!r) return;
  const order = r.palette.map((_, i) => i).sort((a, b) => r.coverage[b] - r.coverage[a]);
  for (const i of order) {
    const c = r.palette[i];
    const li = document.createElement('li');
    const input = document.createElement('input');
    input.type = 'color';
    input.value = threadColor(c);
    input.setAttribute('aria-label', `Thread color ${i + 1}`);
    const name = document.createElement('span');
    name.className = 'name';
    const pct = document.createElement('span');
    pct.className = 'pct';
    pct.textContent = `${(r.coverage[i] * 100).toFixed(1)}%`;
    const bar = document.createElement('span');
    bar.className = 'bar';
    const fillBar = document.createElement('i');
    bar.append(fillBar);
    const refresh = () => {
      const t = nearestThread(input.value, state.chart);
      name.innerHTML = '';
      const b = document.createElement('b');
      b.textContent = t ? `${t[1]} · ${state.chart} ${t[2]}` : input.value;
      const code = document.createElement('code');
      code.textContent = input.value + (state.overrides[c] ? ' · edited' : '');
      name.append(b, code);
      fillBar.style.width = `${Math.max(2, r.coverage[i] * 100)}%`;
      fillBar.style.background = input.value;
    };
    input.addEventListener('input', () => {
      state.overrides[c] = input.value;
      refresh();
      scheduleRecolor();
    });
    refresh();
    li.append(input, name, pct, bar);
    ul.append(li);
  }
  if (!state.params.borderColor) $<HTMLInputElement>('borderColor').value = borderColor() ?? '#222222';
}

function updateDetails() {
  const r = state.result;
  const dl = $('details');
  const ol = $('sequence');
  if (!r) { dl.innerHTML = ''; ol.innerHTML = ''; return; }
  const st = machineStats(machineStitches(r));
  const areaCm2 = (state.params.widthMm * state.params.widthMm * (state.svg?.aspect ?? 1)) / 100; // bounding box
  const minutes = st.stitches / 800 + st.colorChanges * 0.5; // bastidor sewtime.js
  const fmtTime = (m: number) => (m < 60 ? `${Math.max(1, Math.round(m))} min` : `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, '0')} min`);
  const rows: [string, string, boolean?][] = [
    ['Size', `${st.widthMm.toFixed(1)} × ${st.heightMm.toFixed(1)} mm`],
    ['Stitches', st.stitches.toLocaleString()],
    ['Colors', `${r.palette.length}`],
    ['Color changes', `${st.colorChanges}`],
    ['Trims', `${st.trims}`],
    ['Longest stitch', `${st.longestMm.toFixed(1)} mm`, st.longestMm > 12.1],
    ['Density', `${Math.round(st.stitches / areaCm2)} st/cm²`],
    ['Sew time @ 800 spm', fmtTime(minutes)],
  ];
  dl.innerHTML = '';
  for (const [k, v, warn] of rows) {
    const dt = document.createElement('dt');
    dt.textContent = k;
    const dd = document.createElement('dd');
    dd.textContent = v;
    if (warn) dd.className = 'warn';
    dl.append(dt, dd);
  }
  // Thread stops in sewing order (consecutive same-colour blocks merged).
  ol.innerHTML = '';
  let prev = '', count = 0;
  let countEl: HTMLElement | null = null;
  const flush = () => { if (countEl) countEl.textContent = `${count.toLocaleString()} st`; };
  for (const b of r.blocks) {
    const hex = b.kind === 'border' ? borderColor() ?? b.color : colors()[b.paletteIndex] ?? b.color;
    if (hex !== prev) {
      flush();
      prev = hex;
      count = 0;
      const t = nearestThread(hex, state.chart);
      const li = document.createElement('li');
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.background = hex;
      const label = document.createElement('span');
      label.textContent = `${t ? `${t[1]} (${state.chart} ${t[2]})` : hex}${b.kind === 'border' ? ' — border' : ''} · `;
      countEl = document.createElement('span');
      countEl.className = 'muted';
      li.append(dot, label, countEl);
      ol.append(li);
    }
    count += b.points.length / 2;
  }
  flush();
}

function setBusy(text: string | null) {
  $('busy').classList.toggle('on', !!text);
  if (text) $('busyText').textContent = text;
}
function showError(msg: string | null) {
  $('error').hidden = !msg;
  $('errorText').textContent = msg ?? '';
}

// ---------------------------------------------------------------- backdrops (bastidor-style procedural fabric)

function fabricTile(hex: string): string {
  const s = 24;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d')!;
  const n = parseInt(hex.slice(1), 16);
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const col = (d: number) => `rgb(${rgb.map((v) => Math.max(0, Math.min(255, v + d))).join(',')})`;
  g.fillStyle = col(-6);
  g.fillRect(0, 0, s, s);
  // Twill: diagonal ribs, each with a lit and a shaded side.
  for (let i = -s; i < s * 2; i += 4) {
    g.strokeStyle = col(10);
    g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(i, s); g.lineTo(i + s, 0); g.stroke();
    g.strokeStyle = col(-16);
    g.lineWidth = 0.9;
    g.beginPath(); g.moveTo(i + 1.8, s); g.lineTo(i + 1.8 + s, 0); g.stroke();
  }
  // Deterministic speckle so large areas don't look printed.
  for (let i = 0; i < 60; i++) {
    g.fillStyle = i % 2 ? col(14) : col(-18);
    g.fillRect((i * 37) % s, (i * 53) % s, 1, 1);
  }
  return c.toDataURL();
}

function applyBackdrop() {
  const b = BACKDROPS.find((x) => x.id === state.backdrop) ?? BACKDROPS[0];
  const panes = $('panes');
  if (!b.color) {
    panes.style.removeProperty('--backdrop');
    panes.style.removeProperty('--backdrop-size');
  } else {
    panes.style.setProperty('--backdrop', `url(${fabricTile(b.color)})`);
    panes.style.setProperty('--backdrop-size', '12px 12px');
  }
  document.querySelectorAll<HTMLButtonElement>('#backdrop button').forEach((el) => el.classList.toggle('on', el.dataset.id === b.id));
}

function setupBackdrops() {
  const wrap = $('backdrop');
  for (const b of BACKDROPS) {
    const btn = document.createElement('button');
    btn.dataset.id = b.id;
    const sw = document.createElement('span');
    sw.className = 'sw';
    sw.style.background = b.color
      ? `url(${fabricTile(b.color)}) 0 0 / 12px 12px`
      : 'radial-gradient(circle at 30% 20%, #eee 0, #bbb 80%)';
    btn.append(sw, document.createTextNode(b.label));
    btn.onclick = () => { state.backdrop = b.id; applyBackdrop(); savePrefs(); };
    wrap.append(btn);
  }
  applyBackdrop();
}

// ---------------------------------------------------------------- loading

function openSvgText(text: string, name: string, source = '') {
  try {
    const svg = loadSvg(text);
    if (state.svg) URL.revokeObjectURL(state.svg.url);
    state.svg = svg;
    state.name = name.replace(/\.svg$/i, '').replace(/_+/g, ' ').slice(0, 60) || 'patch';
    state.source = source;
    state.result = null;
    state.overrides = {};
    state.simLimit = null;
    stopPlay();
    $<HTMLCanvasElement>('stitched').width = 0;
    $<HTMLCanvasElement>('cmpCanvas').width = 0;
    $<HTMLCanvasElement>('plan').width = 0;
    $('palette').innerHTML = '';
    updateDetails();
    updateSim();
    updateSizeInfo();
    updateDoc();
    updatePatchSvg();
    layoutStages();
    fit();
    document.querySelectorAll<HTMLElement>('.sample').forEach((b) => b.classList.toggle('on', b.dataset.src === source));
    scheduleDigitize(0);
  } catch (err) {
    setBusy(null);
    showError((err as Error).message);
  }
}

async function openUrl(url: string, name?: string) {
  showError(null);
  setBusy('Loading…');
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Download failed (${res.status})`);
    openSvgText(await res.text(), name ?? decodeURIComponent(url.split(/[?#]/)[0].split('/').pop() || 'patch.svg'), url);
  } catch (err) {
    setBusy(null);
    showError(`Couldn't load that URL: ${(err as Error).message}`);
  }
}

/**
 * Accept Commons "File:" page links as well as direct upload URLs. File pages
 * are resolved through the MediaWiki API (CORS-enabled with origin=*) to the
 * upload.wikimedia.org URL, which serves the raw SVG cross-origin.
 */
async function resolveUrl(u: string): Promise<string> {
  const m = /(?:commons\.wikimedia|[a-z]+\.wikipedia)\.org\/wiki\/(File:[^?#]+)/.exec(u);
  if (!m) return u;
  const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&prop=imageinfo&iiprop=url&titles=${encodeURIComponent(decodeURIComponent(m[1]))}`;
  const json = await (await fetch(api)).json();
  const page = Object.values(json?.query?.pages ?? {})[0] as { imageinfo?: { url: string }[] } | undefined;
  const url = page?.imageinfo?.[0]?.url;
  if (!url) throw new Error('File not found on Wikimedia Commons');
  return url;
}

function setupLoading() {
  const drop = $('drop');
  const file = $<HTMLInputElement>('file');
  const readFile = (f: File) => f.text().then((t) => openSvgText(t, f.name));
  file.onchange = () => { if (file.files?.[0]) readFile(file.files[0]); file.value = ''; };
  $('openBtn').onclick = () => file.click();
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('hover'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('hover'));
  // Dropping anywhere on the page works too.
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('hover');
    const f = e.dataTransfer?.files?.[0];
    if (f) readFile(f);
  });

  $('urlForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const u = $<HTMLInputElement>('url').value.trim();
    if (u) resolveUrl(u).then((r) => openUrl(r), (err) => showError(`Couldn't load that URL: ${err.message}`));
  });

  const samples = $('samples');
  for (const s of SAMPLES) {
    const src = `${import.meta.env.BASE_URL}samples/${s.file}`;
    const b = document.createElement('button');
    b.className = 'sample';
    b.title = s.label;
    b.dataset.src = src;
    const img = document.createElement('img');
    img.src = src;
    img.alt = s.label;
    b.append(img);
    b.onclick = () => openUrl(src, s.label);
    samples.append(b);
  }
}

// ---------------------------------------------------------------- export

function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const fileBase = () => state.name.replace(/[^\w-]+/g, '_').slice(0, 40) || 'patch';

function doExport(kind: string) {
  const r = state.result;
  if (kind === 'svg') {
    if (!state.svg) return;
    download(new Blob([buildPatchSvg(state.svg, state.params, r, borderColor(), PAD_MM)], { type: 'image/svg+xml' }), `${fileBase()}-patch.svg`);
    return;
  }
  if (!r) return;
  if (kind === 'png') {
    const c = renderTextured(r, {
      scale: Math.min(24, 6000 / Math.max(r.widthMm, r.heightMm)),
      lightDeg: state.lightDeg, colors: colors(), borderColor: borderColor(), dropShadow: true, finish: state.finish,
    });
    c.toBlob((b) => b && download(b, `${fileBase()}-embroidered.png`), 'image/png');
  } else if (kind === 'dst') {
    download(new Blob([writeDst(r, fileBase())], { type: 'application/octet-stream' }), `${fileBase()}.dst`);
  } else if (kind === 'exp') {
    download(new Blob([writeExp(r)], { type: 'application/octet-stream' }), `${fileBase()}.exp`);
  }
}

// ---------------------------------------------------------------- keyboard

function setupKeys() {
  const views: View[] = ['compare', 'split', 'stitched', 'plan', 'svg'];
  window.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement;
    if (e.metaKey || e.ctrlKey || e.altKey || t.closest('input, select, textarea')) return;
    if (e.key >= '1' && e.key <= '5') setView(views[+e.key - 1]);
    else if (e.key === ' ') { e.preventDefault(); $('play').click(); }
    else if (e.key === 'f') fit();
    else if (e.key === '+' || e.key === '=') $('zoomIn').click();
    else if (e.key === '-') $('zoomOut').click();
    else if (e.key === 'o') $<HTMLInputElement>('file').click();
  });
}

// ---------------------------------------------------------------- boot

function init() {
  loadPrefs();
  RANGE_KEYS.forEach(bindRange);

  $<HTMLInputElement>('varyAngles').onchange = (e) => { state.params.varyAngles = (e.target as HTMLInputElement).checked; scheduleDigitize(); };
  $<HTMLInputElement>('underlay').onchange = (e) => { state.params.underlay = (e.target as HTMLInputElement).checked; scheduleDigitize(); };
  bindSeg('border', () => state.params.border, (v) => { state.params.border = v as DigitizeParams['border']; scheduleDigitize(); });
  const auto = $<HTMLInputElement>('borderAuto');
  const bc = $<HTMLInputElement>('borderColor');
  auto.onchange = () => {
    bc.disabled = auto.checked;
    state.params.borderColor = auto.checked ? null : bc.value;
    scheduleRecolor();
  };
  bc.oninput = () => { state.params.borderColor = bc.value; scheduleRecolor(); };
  $('resetParams').onclick = () => {
    const keep = { widthMm: state.params.widthMm, maxColors: state.params.maxColors, colorTolerance: state.params.colorTolerance };
    state.params = { ...DEFAULT_PARAMS, ...keep };
    syncControls();
    scheduleDigitize(0);
  };

  document.querySelectorAll<HTMLButtonElement>('#sizePresets button').forEach((b) => (b.onclick = () => {
    state.params.widthMm = parseFloat(b.dataset.w!);
    syncControls();
    updateSizeInfo();
    layoutStages();
    fit();
    scheduleDigitize(0);
  }));

  $<HTMLInputElement>('snapChart').onchange = (e) => { state.snap = (e.target as HTMLInputElement).checked; updatePalette(); scheduleRecolor(); };
  $<HTMLSelectElement>('chart').onchange = (e) => { state.chart = (e.target as HTMLSelectElement).value; updatePalette(); scheduleRecolor(); };

  bindSeg('finish', () => state.finish, (v) => { state.finish = v as Finish; scheduleRecolor(); });
  const light = $<HTMLInputElement>('lightDeg');
  light.oninput = () => {
    state.lightDeg = parseFloat(light.value);
    $('lightDegOut').textContent = FORMAT.lightDeg!(state.lightDeg);
    scheduleRecolor();
  };

  document.querySelectorAll<HTMLButtonElement>('#tabs button').forEach((b) => (b.onclick = () => setTab(b.dataset.tab!)));
  $('exportBtn').onclick = () => {
    setTab('export');
    if (isMobile()) $('tabs').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  document.querySelectorAll<HTMLButtonElement>('[data-export]').forEach((b) => (b.onclick = () => doExport(b.dataset.export!)));
  $('errorClose').onclick = () => showError(null);

  bindSeg('view', () => state.view, (v) => setView(v as View));
  setView(state.view);
  syncControls();
  setupBackdrops();
  setupPanZoom();
  setupWipe();
  setupSim();
  setupLoading();
  setupKeys();

  const sampleSrcs = SAMPLES.map((s) => `${import.meta.env.BASE_URL}samples/${s.file}`);
  // Reopen the last remote/sample source; local files can't be reopened.
  const src = state.source && /^(https?:|\/)/.test(state.source) ? state.source : sampleSrcs[0];
  const sample = SAMPLES[sampleSrcs.indexOf(src)];
  openUrl(src, sample?.label);
}

init();
