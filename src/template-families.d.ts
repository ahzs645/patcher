export interface TemplateFamily {
  id: string;
  label: string;
  description: string;
  basis: string;
  members: string[];
}
export interface TemplateFamilyCatalogue {
  version: number;
  families: {
    id: string;
    label: string;
    description: string;
    basis: string;
    members?: string[];
    variantGroups?: string[];
  }[];
}
export function resolveTemplateFamilies(
  manifest: {
    orgs: { patches: { id: string; collection: string }[] }[];
    variants: { id: string; members: { id: string }[] }[];
  },
  catalogue: TemplateFamilyCatalogue,
): TemplateFamily[];
