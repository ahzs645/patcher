import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveTemplateFamilies } from './template-families.js';

const manifest = JSON.parse(readFileSync(new URL('../library/manifest.json', import.meta.url), 'utf8'));
const catalogue = JSON.parse(readFileSync(new URL('../library/template-families.json', import.meta.url), 'utf8'));
const smallManifest = {
  orgs: [{ patches: [{ id: 'A', collection: 'patches' }, { id: 'B', collection: 'patches' }, { id: 'C', collection: 'badges' }] }],
  variants: [{ id: 'pair', members: [{ id: 'A' }, { id: 'B' }] }],
};
const family = (extra = {}) => ({ id: 'family', label: 'Family', description: 'Related layout', basis: 'Reviewed specimens', ...extra });
const spec = (...families) => ({ version: 1, families });

test('the curated catalogue covers whole variant cards without losing unclassified designs', () => {
  const families = resolveTemplateFamilies(manifest, catalogue);
  const ids = families.flatMap((entry) => entry.members);
  assert.equal(new Set(ids).size, ids.length);
  const known = manifest.orgs.flatMap((org) => org.patches.map((patch) => patch.id));
  assert.ok(known.some((id) => !ids.includes(id)), 'Unclassified designs remain available in Other designs');
  const shield = families.find((entry) => entry.id === 'provincial-ministry-shield');
  assert.equal(shield.members.length, 15);
  assert.equal(manifest.orgs.filter((org) => org.patches.some((patch) => shield.members.includes(patch.id))).length, 5);
  assert.ok(!shield.members.includes('S56-O44'), 'The differently shaped Coroners patch must not be grouped merely for sharing arms');
});

test('one group reference expands all variants without changing the source catalogue', () => {
  const before = JSON.stringify(smallManifest);
  assert.deepEqual(resolveTemplateFamilies(smallManifest, spec(family({ variantGroups: ['pair'] })))[0].members, ['A', 'B']);
  assert.equal(JSON.stringify(smallManifest), before);
});

test('unknown members, unknown groups and duplicate membership fail clearly', () => {
  assert.throws(() => resolveTemplateFamilies(smallManifest, spec(family({ members: ['A', 'missing'] }))), /unknown patch missing/);
  assert.throws(() => resolveTemplateFamilies(smallManifest, spec(family({ variantGroups: ['missing'] }))), /unknown variant group missing/);
  assert.throws(() => resolveTemplateFamilies(smallManifest, spec(family({ members: ['A'], variantGroups: ['pair'] }))), /assigned to both/);
  assert.throws(() => resolveTemplateFamilies(smallManifest, spec(family({ members: ['A', 'B'] }), family({ id: 'second', members: ['A', 'B'] }))), /assigned to both/);
});

test('families preserve collection boundaries and never split an existing variant card', () => {
  assert.throws(() => resolveTemplateFamilies(smallManifest, spec(family({ members: ['A', 'C'] }))), /cannot mix patches and badges/);
  const extended = structuredClone(smallManifest);
  extended.orgs[0].patches.push({ id: 'D', collection: 'patches' });
  assert.throws(() => resolveTemplateFamilies(extended, spec(family({ members: ['A', 'D'] }))), /all variants must belong to the same/);
});

test('badges keep their individual numbers even when sharing a template', () => {
  const family = resolveTemplateFamilies(manifest, catalogue).find((entry) => entry.id === 'parks-ranger-numbered-metal');
  assert.deepEqual(family.members, ['S11-O01', 'S12-O01', 'S17-O01', 'S20-O01']);
  const patches = manifest.orgs.flatMap((org) => org.patches);
  for (const id of family.members) assert.equal(patches.find((patch) => patch.id === id).collection, 'badges');
});
