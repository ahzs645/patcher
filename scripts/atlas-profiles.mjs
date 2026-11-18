import { readFileSync } from 'node:fs';

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
  return svg.replace('</desc>', ' ' + profile.note + '</desc>');
}
