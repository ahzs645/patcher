// Joining a stored library patch back into its full SVG.
//
// The import (scripts/import-atlas.mjs, via scripts/share-parts.mjs) stores what patches repeat
// once, in library/shared/, and leaves a reference where it was. There are two kinds:
//
//   blocks  A <g>'s whole content: a crest, a coat of arms. The <g> stays, holding a placeholder:
//             <g data-component="co-service-wreath-emblem" transform="…"><g data-shared="ID"/></g>
//           Stored as library/shared/<ID>.svg, a viewable SVG around the exact bytes.
//   paths   One long path outline (d="…") that recurs with other colours or positions: recoloured
//           arms, outlined lettering. The attribute stays, naming its value: d="@ID". Stored in
//           JSON bundles, library/shared/paths-*.json, { "ID": "M…Z" }.
//
// Joining puts every byte back: the result is the original file, whose SHA-256 the manifest
// records. Blocks can hold blocks and paths; path values hold nothing.
//
// Plain JavaScript (types in library-join.d.ts) so the import, the verifier, the app and any
// host's tests all run the same code. No DOM, no bundler.

const BLOCK = /<g data-shared="([\w.-]+)"\/>/g
const PATH = /(\s)d="@([\w.-]+)"/g

/** The placeholder for a shared block. */
export const blockPlaceholder = (id) => `<g data-shared="${id}"/>`
/** The attribute for a shared path value (`attr` keeps whatever whitespace preceded it). */
export const pathReference = (id) => `d="@${id}"`
/** Whether a source text already uses either form, which would make joining ambiguous. */
export const hasReferences = (text) => /data-shared="|\sd="@/.test(text)

const partOpen = (id) => `<svg xmlns="http://www.w3.org/2000/svg" data-shared-part="${id}">`
const PART_CLOSE = '</svg>'

/** A shared block's file contents, from the bytes it stands for. */
export const wrapBlock = (id, content) => `${partOpen(id)}${content}${PART_CLOSE}`

/** The bytes a shared block stands for, from its file contents. */
export function unwrapBlock (id, file) {
  const open = partOpen(id)
  if (!file.startsWith(open) || !file.endsWith(PART_CLOSE)) throw new Error(`${id} is not a shared block file`)
  return file.slice(open.length, file.length - PART_CLOSE.length)
}

/** The shared blocks and path values a stored text names directly. */
export function references (text) {
  return {
    blocks: [...new Set([...text.matchAll(BLOCK)].map((m) => m[1]))],
    paths: [...new Set([...text.matchAll(PATH)].map((m) => m[2]))]
  }
}

/**
 * Join a stored text with its shared blocks and path values.
 * @param {string} text
 * @param {{ block: (id: string) => string, path: (id: string) => string }} store
 *   A block's bytes (unwrapped) and a path value, by id. Either throws or returns undefined when
 *   it doesn't have one, which is an error.
 */
export function joinSvg (text, store) {
  const block = (id, depth) => {
    if (depth > 32) throw new Error('Shared blocks nest too deeply')
    const content = store.block(id)
    if (typeof content !== 'string') throw new Error(`Missing shared block ${id}`)
    return content.replace(new RegExp(BLOCK.source, 'g'), (_m, sub) => block(sub, depth + 1))
  }
  const blocks = text.replace(new RegExp(BLOCK.source, 'g'), (_m, id) => block(id, 0))
  return blocks.replace(new RegExp(PATH.source, 'g'), (_m, space, id) => {
    const value = store.path(id)
    if (typeof value !== 'string') throw new Error(`Missing shared path ${id}`)
    return `${space}d="${value}"`
  })
}
