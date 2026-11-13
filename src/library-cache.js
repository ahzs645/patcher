// A bounded cache for complete SVG text. Shared component caches live in library.ts;
// this avoids fetching, joining and hashing a drawing again when a viewer returns to it.
// Only completed values count toward the limit. Pending requests share one promise and
// failed requests are forgotten. clear() also prevents an older request from replacing
// a newer request for the same key when it eventually settles.

/**
 * @param {{ maxBytes?: number }} [options]
 * @returns {{ get: (key: string, load: () => string | Promise<string>) => Promise<string>, clear: () => void }}
 */
export function createTextCache({ maxBytes = 16 * 1024 * 1024 } = {}) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) throw new RangeError('maxBytes must be a non-negative safe integer');
  const ready = new Map();
  const pending = new Map();
  const encoder = new TextEncoder();
  let readyBytes = 0;

  return {
    get(key, load) {
      const hit = ready.get(key);
      if (hit) {
        ready.delete(key);
        ready.set(key, hit);
        return Promise.resolve(hit.value);
      }
      if (pending.has(key)) return pending.get(key);

      const request = Promise.resolve().then(load).then((value) => {
        if (typeof value !== 'string') throw new TypeError('Text cache loaders must return a string');
        // A clear followed by another request must not be undone by this old result.
        if (pending.get(key) !== request) return value;
        pending.delete(key);
        const bytes = encoder.encode(value).byteLength;
        // Oversized drawings are returned to their caller without displacing useful entries.
        if (bytes <= maxBytes) {
          while (readyBytes + bytes > maxBytes && ready.size) {
            const oldest = ready.keys().next().value;
            readyBytes -= ready.get(oldest).bytes;
            ready.delete(oldest);
          }
          ready.set(key, { value, bytes });
          readyBytes += bytes;
        }
        return value;
      }).catch((error) => {
        if (pending.get(key) === request) pending.delete(key);
        throw error;
      });
      pending.set(key, request);
      return request;
    },

    clear() {
      ready.clear();
      pending.clear();
      readyBytes = 0;
    },
  };
}
