export interface SharedStore {
  block(id: string): string | undefined;
  path(id: string): string | undefined;
}
export declare function blockPlaceholder(id: string): string;
export declare function pathReference(id: string): string;
export declare function hasReferences(text: string): boolean;
export declare function wrapBlock(id: string, content: string): string;
export declare function unwrapBlock(id: string, file: string): string;
export declare function references(text: string): { blocks: string[]; paths: string[] };
export declare function joinSvg(text: string, store: SharedStore): string;
