// Curated template relationships are independent of variant cards and source sightings.
// A shared crest or colour alone is not enough to put two patches in one template family.

/** Resolve compact group references and reject ambiguous membership before displaying a catalogue. */
export function resolveTemplateFamilies(manifest, catalogue) {
  if (catalogue?.version !== 1 || !Array.isArray(catalogue.families)) {
    throw new Error('Template family catalogue must have version 1 and a families array');
  }
  const patches = new Map(manifest.orgs.flatMap((org) => org.patches.map((patch) => [patch.id, patch])));
  const variants = new Map(manifest.variants.map((group) => [group.id, group]));
  const familyIds = new Set();
  const assigned = new Map();
  const families = catalogue.families.map((family) => {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(family.id) || familyIds.has(family.id)) {
      throw new Error(`Invalid or duplicate template family: ${family.id}`);
    }
    familyIds.add(family.id);
    if (!family.label?.trim() || !family.description?.trim() || !family.basis?.trim()) {
      throw new Error(`${family.id}: label, description and classification basis are required`);
    }
    const members = [...(family.members ?? [])];
    for (const groupId of family.variantGroups ?? []) {
      const group = variants.get(groupId);
      if (!group) throw new Error(`${family.id}: unknown variant group ${groupId}`);
      members.push(...group.members.map(({ id }) => id));
    }
    if (members.length < 2) throw new Error(`${family.id}: a template family needs at least two members`);
    for (const id of members) {
      if (!patches.has(id)) throw new Error(`${family.id}: unknown patch ${id}`);
      if (assigned.has(id)) throw new Error(`${id}: assigned to both ${assigned.get(id)} and ${family.id}`);
      assigned.set(id, family.id);
    }
    if (new Set(members.map((id) => patches.get(id).collection)).size !== 1) {
      throw new Error(`${family.id}: a template family cannot mix patches and badges`);
    }
    return { id: family.id, label: family.label, description: family.description, basis: family.basis, members };
  });
  // A card cannot silently disappear or appear twice when a family filter is selected.
  for (const group of variants.values()) {
    const memberships = new Set(group.members.map(({ id }) => assigned.get(id) ?? null));
    if (memberships.size > 1) throw new Error(`${group.id}: all variants must belong to the same template family`);
  }
  return families;
}
