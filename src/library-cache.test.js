import assert from 'node:assert/strict';
import test from 'node:test';
import { createTextCache } from './library-cache.js';

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('concurrent readers share one request and completed text is reused', async () => {
  const cache = createTextCache();
  const source = deferred();
  let calls = 0;
  const load = () => { calls++; return source.promise; };
  const first = cache.get('svg', load);
  const second = cache.get('svg', load);
  assert.equal(first, second);
  source.resolve('<svg/>');
  assert.equal(await first, '<svg/>');
  assert.equal(await cache.get('svg', load), '<svg/>');
  assert.equal(calls, 1);
});

test('a failed download or hash validation is retried, including synchronous errors', async () => {
  const cache = createTextCache();
  await assert.rejects(cache.get('svg', () => { throw new Error('hash mismatch'); }), /hash mismatch/);
  await assert.rejects(cache.get('svg', () => Promise.reject(new Error('HTTP 503'))), /HTTP 503/);
  assert.equal(await cache.get('svg', () => '<svg/>'), '<svg/>');
});

test('eviction follows least recent use and counts UTF-8 bytes rather than characters', async () => {
  const cache = createTextCache({ maxBytes: 6 });
  await cache.get('a', () => 'aa');
  await cache.get('b', () => 'bb');
  await cache.get('a', () => assert.fail('a should be cached'));
  await cache.get('c', () => 'éé'); // Four bytes; b is the least recently used two bytes.
  assert.equal(await cache.get('a', () => assert.fail('a should survive')), 'aa');
  assert.equal(await cache.get('b', () => 'reloaded'), 'reloaded');
  assert.equal(await cache.get('c', () => assert.fail('c should survive an oversized result')), 'éé');
});

test('drawings over the byte limit are shared in flight but not retained', async () => {
  const cache = createTextCache({ maxBytes: 2 });
  let calls = 0;
  const load = () => { calls++; return 'three'; };
  const a = cache.get('large', load);
  assert.equal(cache.get('large', load), a);
  await a;
  await cache.get('large', load);
  assert.equal(calls, 2);
});

test('clearing a pending request prevents its old success from overwriting new text', async () => {
  const cache = createTextCache();
  const source = deferred();
  const old = cache.get('svg', () => source.promise);
  cache.clear();
  assert.equal(await cache.get('svg', () => 'new'), 'new');
  source.resolve('old');
  assert.equal(await old, 'old');
  assert.equal(await cache.get('svg', () => assert.fail('new should remain cached')), 'new');
});

test('an old rejection cannot evict a newer pending request after clear', async () => {
  const cache = createTextCache();
  const firstSource = deferred();
  const secondSource = deferred();
  const old = cache.get('svg', () => firstSource.promise);
  const oldRejection = assert.rejects(old, /old failure/);
  cache.clear();
  const current = cache.get('svg', () => secondSource.promise);
  firstSource.reject(new Error('old failure'));
  await oldRejection;
  assert.equal(cache.get('svg', () => assert.fail('new request is still pending')), current);
  secondSource.resolve('new');
  assert.equal(await current, 'new');
});

test('clear releases the previous byte budget and entries', async () => {
  const cache = createTextCache({ maxBytes: 2 });
  await cache.get('old', () => 'aa');
  cache.clear();
  await cache.get('new', () => 'bb');
  assert.equal(await cache.get('new', () => assert.fail('new should be cached')), 'bb');
  assert.equal(await cache.get('old', () => 'cc'), 'cc');
});

test('invalid budgets and non-text results fail without poisoning the cache', async () => {
  for (const maxBytes of [-1, Infinity, NaN, 1.5]) assert.throws(() => createTextCache({ maxBytes }), RangeError);
  const cache = createTextCache();
  await assert.rejects(cache.get('svg', () => null), /return a string/);
  assert.equal(await cache.get('svg', () => 'valid'), 'valid');
});
