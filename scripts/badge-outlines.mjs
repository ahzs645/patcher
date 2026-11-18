// Each profile changes one specific atlas path, including its repeated rim stroke.
// Match the source exactly so an updated atlas drawing requires a fresh review.
import { readFileSync } from 'node:fs';

const profiles = JSON.parse(readFileSync(new URL('../library/supplied/badge-outlines/profiles.json', import.meta.url), 'utf8'));
export const badgeOutlines = new Map(profiles.flatMap((profile) => profile.ids.map((id) => [id, profile])));

export function applyBadgeOutline(svg, profile) {
  const original = `d="${profile.original}"`;
  const parts = svg.split(original);
  if (parts.length !== profile.occurrences + 1) throw new Error(`Unexpected atlas geometry for ${profile.name}`);
  return parts.join(`d="${profile.path}"`).replace('</desc>', ` ${profile.note}</desc>`);
}
