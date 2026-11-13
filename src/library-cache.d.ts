export interface TextCache {
  get(key: string, load: () => string | Promise<string>): Promise<string>;
  clear(): void;
}

/** Completed UTF-8 text is bounded by maxBytes; pending requests are coalesced. */
export function createTextCache(options?: { maxBytes?: number }): TextCache;
