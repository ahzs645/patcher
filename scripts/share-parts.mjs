// Find what the library's SVGs repeat and store each repeated thing once (see src/library-join.js
// for the two forms and how they are joined back).
//
// 1. Blocks. When the same bytes sit inside a <g> (or a prefixed <ns0:g>) in two or more places,
//    they become a shared block, and each place keeps its <g> with a placeholder inside. Passes
//    repeat, biggest saving first, over the patches and the blocks already found, so a block can
//    hold blocks: the Conservation Officer crest that two shoulder patches carry whole, and the cap
//    crest carries inside its larger ribbon edition, is one block used by all three.
// 2. Path values. A long path outline (d="…") that still occurs more than once, usually the same
//    shape in another colour or place (a recoloured coat of arms, outlined lettering), is stored
//    once and referenced as d="@ID". Values are bundled by exactly the patches that need them, and
//    only where that group shares at least BUNDLE_MIN_BYTES: opening a patch then fetches only
//    outlines it draws, in a handful of requests, never more bytes than its original file.
//
// Only exact bytes move, so joining gives back each original file byte for byte.

import { createHash } from 'node:crypto';
import { blockPlaceholder, pathReference, references } from '../src/library-join.js';

/** Block content smaller than this stays put: the placeholder and request cost more than it saves. */
const BLOCK_MIN_BYTES = 2048;
/** Path values shorter than this stay put. */
const PATH_MIN_BYTES = 256;
/** A group of patches gets its own path bundle once it shares this much; smaller ones go in the common bundle. */
const BUNDLE_MIN_BYTES = 4096;

const sha = (text) => createHash('sha256').update(text).digest('hex');

// A start or end tag (quoted attribute values may hold '>'), or a comment, CDATA section or
// processing instruction, which are skipped whole.
const TOKEN = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<(\/?)([A-Za-z][\w:.-]*)((?:\s+[^\s=/>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'))?)*)\s*(\/?)>/g;

/**
 * Every <g>…</g> (or <prefix:g>) in a text: where its content starts and ends, and a name for it
 * from its own data-component / data-caption, or else its nearest ancestor's.
 */
function groups(text, name) {
  const out = [];
  const stack = [];
  const token = new RegExp(TOKEN.source, 'g');
  for (let m; (m = token.exec(text));) {
    const tag = m[2];
    if (!tag) continue;
    if (m[1]) {
      const open = stack.pop();
      if (!open || open.tag !== tag) throw new Error(`${name}: </${tag}> does not close <${open?.tag}> at ${m.index}`);
      // Supplied artwork often arrives as <ns0:g xmlns:ns0="http://www.w3.org/2000/svg">.
      if (tag === 'g' || tag.endsWith(':g')) out.push({ start: open.end, end: m.index, hint: hintOf([open, ...stack.toReversed()]) });
    } else if (!m[4]) {
      stack.push({ tag, end: token.lastIndex, startTag: m[0] });
    }
  }
  if (stack.length) throw new Error(`${name}: <${stack.at(-1).tag}> is never closed`);
  return out;
}

const hintOf = (elements) => {
  for (const { startTag } of elements) {
    const label = /data-(?:component|caption)="([^"]+)"/.exec(startTag)?.[1];
    const slug = label?.toLowerCase().replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
    if (slug) return slug;
  }
  return 'block';
};

const overlaps = (spans, o) => spans.some((s) => o.start < s.end && s.start < o.end);
const count = (text, needle) => text.split(needle).length - 1;

function shareBlocks(texts, blocks) {
  for (;;) {
    const found = new Map();
    for (const [name, text] of texts) {
      for (const g of groups(text, name)) {
        if (g.end - g.start < BLOCK_MIN_BYTES) continue;
        const content = text.slice(g.start, g.end);
        const key = sha(content);
        if (!found.has(key)) found.set(key, { key, length: content.length, hint: g.hint, occurrences: [] });
        found.get(key).occurrences.push({ name, start: g.start, end: g.end });
      }
    }
    // Biggest saving first; a place inside (or around) one already chosen waits for a later pass.
    const ranked = [...found.values()]
      .filter((c) => c.occurrences.length > 1)
      .sort((a, b) => b.length * (b.occurrences.length - 1) - a.length * (a.occurrences.length - 1) || (a.key < b.key ? -1 : 1));
    const taken = new Map();
    const picks = [];
    for (const c of ranked) {
      const free = c.occurrences.filter((o) => !overlaps(taken.get(o.name) ?? [], o));
      if (free.length < 2) continue;
      for (const o of free) taken.set(o.name, [...(taken.get(o.name) ?? []), o]);
      picks.push({ ...c, occurrences: free });
    }
    if (!picks.length) return;

    const cuts = new Map();
    const created = [];
    for (const pick of picks) {
      const first = pick.occurrences[0];
      const content = texts.get(first.name).slice(first.start, first.end);
      const id = `${pick.hint}-${pick.key.slice(0, 10)}`;
      if (blocks.has(id) && blocks.get(id) !== content) throw new Error(`block id collision: ${id}`);
      created.push([id, content]);
      for (const o of pick.occurrences) {
        if (texts.get(o.name).slice(o.start, o.end) !== content) throw new Error(`hash collision in ${o.name}`);
        cuts.set(o.name, [...(cuts.get(o.name) ?? []), { ...o, id }]);
      }
    }
    for (const [name, list] of cuts) {
      let text = texts.get(name);
      for (const o of list.sort((a, b) => b.start - a.start)) text = text.slice(0, o.start) + blockPlaceholder(o.id) + text.slice(o.end);
      texts.set(name, text);
    }
    for (const [id, content] of created) {
      blocks.set(id, content);
      texts.set(`block:${id}`, content);
    }
  }
}

/** A block that ended up with a single use (its one user became a block itself) goes back in place. */
function inlineSingleUseBlocks(texts, blocks) {
  for (;;) {
    const uses = new Map();
    for (const text of texts.values()) for (const id of references(text).blocks) uses.set(id, (uses.get(id) ?? 0) + count(text, blockPlaceholder(id)));
    const single = [...blocks.keys()].find((id) => (uses.get(id) ?? 0) < 2);
    if (!single) return;
    const content = blocks.get(single);
    blocks.delete(single);
    texts.delete(`block:${single}`);
    for (const [name, text] of texts) {
      if (text.includes(blockPlaceholder(single))) texts.set(name, text.replace(blockPlaceholder(single), () => content));
    }
  }
}

/** The shared blocks a text needs, following blocks into blocks. */
function blocksNeeded(text, blocks, seen = new Set()) {
  for (const id of references(text).blocks) {
    if (!seen.has(id)) { seen.add(id); blocksNeeded(blocks.get(id), blocks, seen); }
  }
  return seen;
}

/**
 * Path values worth sharing, bundled by the patches that need them. A bundle only ever holds
 * values every one of its patches needs, so opening a patch never downloads outlines it doesn't
 * draw; a group of patches whose shared outlines come to less than BUNDLE_MIN_BYTES keeps them
 * inline, because the extra request would cost more than the bytes it saves.
 */
function sharePaths(texts, docs, blocks) {
  const VALUE = /(\s)d="([^"@][^"]*)"/g;
  const counts = new Map();
  for (const text of texts.values()) {
    for (const m of text.matchAll(VALUE)) if (m[2].length >= PATH_MIN_BYTES) counts.set(m[2], (counts.get(m[2]) ?? 0) + 1);
  }
  const repeated = new Set([...counts].filter(([, n]) => n > 1).map(([value]) => value));

  // Which patches need each repeated value: in their own file or in a block they need.
  const users = new Map();
  for (const name of docs.keys()) {
    const sources = [texts.get(name), ...[...blocksNeeded(texts.get(name), blocks)].map((id) => blocks.get(id))];
    for (const text of sources) {
      for (const m of text.matchAll(VALUE)) {
        if (!repeated.has(m[2])) continue;
        if (!users.has(m[2])) users.set(m[2], new Set());
        users.get(m[2]).add(name);
      }
    }
  }
  const groupsByUsers = new Map();
  for (const [value, names] of users) {
    const key = [...names].sort().join('\n');
    if (!groupsByUsers.has(key)) groupsByUsers.set(key, []);
    groupsByUsers.get(key).push(value);
  }

  const ids = new Map();
  const bundles = [];
  for (const [key, values] of groupsByUsers) {
    if (values.reduce((n, v) => n + v.length, 0) < BUNDLE_MIN_BYTES) continue;
    const bundle = { name: `paths-${sha(key).slice(0, 10)}`, ids: [] };
    for (const value of values) {
      const id = `p${sha(value).slice(0, 12)}`;
      if (ids.has(value) || [...ids.values()].includes(id)) throw new Error(`path id collision: ${id}`);
      ids.set(value, id);
      bundle.ids.push(id);
    }
    bundle.ids.sort();
    bundles.push(bundle);
  }
  bundles.sort((a, b) => (a.name < b.name ? -1 : 1));

  for (const [name, text] of texts) {
    texts.set(name, text.replace(VALUE, (whole, space, value) => (ids.has(value) ? `${space}${pathReference(ids.get(value))}` : whole)));
  }
  return { paths: new Map([...ids].map(([value, id]) => [id, value])), bundles };
}

/**
 * @param {Map<string, string>} docs  Each patch's SVG text, by name.
 */
export function shareParts(docs) {
  const texts = new Map(docs);
  const blocks = new Map();
  shareBlocks(texts, blocks);
  inlineSingleUseBlocks(texts, blocks);
  for (const id of blocks.keys()) blocks.set(id, texts.get(`block:${id}`));
  const { paths, bundles } = sharePaths(texts, docs, blocks);
  for (const id of blocks.keys()) blocks.set(id, texts.get(`block:${id}`));

  // What each patch needs: its blocks (following blocks into blocks) and the bundles of every path
  // value they and it reference.
  const bundleOf = new Map(bundles.flatMap((b) => b.ids.map((id) => [id, b.name])));
  const needs = new Map();
  for (const name of docs.keys()) {
    const text = texts.get(name);
    const needed = [...blocksNeeded(text, blocks)].sort();
    const pathIds = [text, ...needed.map((id) => blocks.get(id))].flatMap((t) => references(t).paths);
    needs.set(name, { blocks: needed, bundles: [...new Set(pathIds.map((id) => bundleOf.get(id)))].sort() });
  }

  return {
    docs: new Map([...docs.keys()].map((name) => [name, texts.get(name)])),
    blocks,
    paths,
    bundles,
    needs,
  };
}
