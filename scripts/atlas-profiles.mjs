import { readFileSync } from 'node:fs';

import { along, face, sampleQuadratics, trackingFor } from '../library/supplied/lettering/lettering.mjs';

const condensed = face('roboto-condensed-bold');
const supplied = new URL('../library/supplied/', import.meta.url);
export const atlasProfiles = new Map();
for (const folder of ['badge-outlines', 'patch-adjustments']) {
  const profiles = JSON.parse(readFileSync(new URL(folder + '/profiles.json', supplied), 'utf8'));
  for (const profile of profiles) {
    for (const id of profile.ids) {
      if (atlasProfiles.has(id)) throw new Error('Duplicate geometry profile for ' + id);
      atlasProfiles.set(id, { ...profile, folder });
    }
  }
}

// Atlas rocker masters are 100 units wide. The quadratic baseline is in the
// existing caption group's coordinates, preserving the source-instance transform.
function fitRockerCaption(svg, row) {
  const opening = `<g data-caption="${row.text}">`;
  const start = svg.indexOf(opening);
  const end = svg.indexOf('</g>', start);
  if (start < 0 || end < 0 || svg.indexOf(opening, start + 1) >= 0) {
    throw new Error('Expected one atlas caption for ' + row.text);
  }
  const paths = svg.slice(start + opening.length, end);
  const fill = paths.match(/fill="(#[0-9a-fA-F]{6})"/)?.[1];
  if (!fill || paths.includes('<g')) throw new Error('Unexpected letter paths for ' + row.text);
  const top = row.baseline;
  const depth = row.riseAtEnds;
  const points = sampleQuadratics([[[0, top + depth], [50, top - depth], [100, top + depth]]]);
  const { text, capHeight, wordSpace, stretch = 1 } = row;
  const tracking = trackingFor(condensed, text, capHeight, row.span / stretch, { wordSpace });
  const caption = along(condensed, text, { points, capHeight, fill, tracking, wordSpace, stretch });
  return svg.slice(0, start) + caption + svg.slice(end + '</g>'.length);
}

// Match the annotated atlas geometry exactly, including repeated rim strokes.
export function applyAtlasProfile(svg, profile) {
  const changes = profile.changes ?? [{
    original: `d="${profile.original}"`,
    revised: `d="${profile.path}"`,
    occurrences: profile.occurrences,
  }];
  for (const { original, revised, occurrences = 1 } of changes) {
    const parts = svg.split(original);
    if (parts.length !== occurrences + 1) throw new Error('Unexpected atlas geometry for ' + profile.name);
    svg = parts.join(revised);
  }
  for (const row of profile.captions ?? []) svg = fitRockerCaption(svg, row);
  return svg.replace('</desc>', ' ' + profile.note + '</desc>');
}
